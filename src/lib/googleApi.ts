import type { Activity, ActivityInsert } from '../types'

const SHEET_HEADERS = ['id', 'name', 'duration_minutes', 'end_time', 'created_at']

/** Sheets stores dates as serial numbers (days since 1899-12-30). Convert to ISO string for display. */
function cellToISOString(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  // Serial 25569 = Jan 1, 1970 00:00 UTC; round to avoid floating-point minute drift
  const ms = Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

async function api<T>(
  accessToken: string,
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED')
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json()
}

const FLOGGER_SHEET_NAME = 'Flogger'
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet'
const APP_CONFIG_FILENAME = 'flogger-config.json'

interface AppConfig {
  spreadsheetId: string
}

/**
 * Read the Flogger config from appDataFolder. This folder is shared across all
 * OAuth sessions for the same Google account + OAuth client ID, making it a
 * true single source of truth regardless of browser, device, or incognito mode.
 */
async function readAppConfig(accessToken: string): Promise<{ fileId: string; config: AppConfig } | null> {
  const q = `name='${APP_CONFIG_FILENAME}' and 'appDataFolder' in parents and trashed=false`
  const params = new URLSearchParams({ q, spaces: 'appDataFolder', fields: 'files(id)', pageSize: '1', orderBy: 'createdTime' })
  const result = await api<{ files?: { id: string }[] }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?${params}`
  )
  const file = result.files?.[0]
  if (!file) return null
  const config = await api<AppConfig>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  )
  return { fileId: file.id, config }
}

/** Write the Flogger config to appDataFolder, creating or updating the file. */
async function writeAppConfig(accessToken: string, config: AppConfig, existingFileId?: string): Promise<void> {
  const body = JSON.stringify(config)
  if (existingFileId) {
    await api<unknown>(
      accessToken,
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
      { method: 'PATCH', body }
    )
  } else {
    const file = await api<{ id: string }>(accessToken, 'https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      body: JSON.stringify({ name: APP_CONFIG_FILENAME, parents: ['appDataFolder'], mimeType: 'application/json' }),
    })
    await api<unknown>(
      accessToken,
      `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
      { method: 'PATCH', body }
    )
  }
}

/** Verify that a spreadsheet ID is still accessible (e.g. not deleted by the user). */
async function spreadsheetExists(accessToken: string, spreadsheetId: string): Promise<boolean> {
  try {
    await api<unknown>(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`)
    return true
  } catch {
    return false
  }
}

/** Find an existing Flogger spreadsheet in the user's Drive by name. Migration fallback only. */
async function findFloggerSpreadsheet(accessToken: string): Promise<string | null> {
  const q = [
    `name='${FLOGGER_SHEET_NAME}'`,
    `mimeType='${SPREADSHEET_MIME}'`,
    'trashed=false',
  ].join(' and ')
  const params = new URLSearchParams({ q, orderBy: 'createdTime', pageSize: '1', fields: 'files(id)' })
  const result = await api<{ files?: { id: string }[] }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?${params}`
  )
  const file = result.files?.[0]
  return file?.id ?? null
}

/**
 * Resolve the spreadsheet ID to use for this session.
 *
 * Priority:
 *   1. appDataFolder config – shared across all devices/browsers for the same
 *      Google account, so every instance converges on the same sheet instantly.
 *   2. Drive name search – migration path for users who had a sheet before
 *      appDataFolder was introduced.
 *   3. Create a new spreadsheet.
 *
 * After resolving via (2) or (3), the ID is written back to appDataFolder so
 * that all subsequent sign-ins (on any device) skip straight to step 1.
 */
export async function findOrCreateSpreadsheet(accessToken: string): Promise<string> {
  const stored = await readAppConfig(accessToken)
  if (stored) {
    const exists = await spreadsheetExists(accessToken, stored.config.spreadsheetId)
    if (exists) return stored.config.spreadsheetId
    // Sheet was deleted; fall through to find or create a replacement
  }

  const existing = await findFloggerSpreadsheet(accessToken)
  const spreadsheetId = existing ?? await createSpreadsheet(accessToken)

  await writeAppConfig(accessToken, { spreadsheetId }, stored?.fileId)

  return spreadsheetId
}

/** Create a new spreadsheet in the user's Drive and set headers. Returns spreadsheet ID. */
export async function createSpreadsheet(accessToken: string): Promise<string> {
  const file = await api<{ id: string }>(accessToken, 'https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    body: JSON.stringify({
      name: FLOGGER_SHEET_NAME,
      mimeType: SPREADSHEET_MIME,
    }),
  })
  const spreadsheetId = file.id
  await api<unknown>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:E1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    }
  )
  return spreadsheetId
}

/** Get all activities from the sheet. Row index is 1-based sheet row (row 2 = first data row). */
export async function getActivities(
  accessToken: string,
  spreadsheetId: string
): Promise<Activity[]> {
  const result = await api<{ values?: string[][] }>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:E?valueRenderOption=UNFORMATTED_VALUE`
  )
  const rows = result.values ?? []
  return rows.map((row, i) => {
    const [id, name, duration_minutes, end_time, created_at] = row
    return {
      id: id ?? '',
      name: name ?? '',
      duration_minutes: Number(duration_minutes) || 0,
      end_time: cellToISOString(end_time),
      created_at: cellToISOString(created_at) ?? new Date().toISOString(),
      rowIndex: i + 2,
    } as Activity
  }).filter(a => a.id).reverse()
}

/** Append one activity. Generates id and created_at. */
export async function appendActivity(
  accessToken: string,
  spreadsheetId: string,
  entry: ActivityInsert
): Promise<void> {
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  const end_time = entry.end_time ?? ''
  await api<unknown>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:E:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [[id, entry.name.trim(), entry.duration_minutes, end_time, created_at]],
      }),
    }
  )
}

/** Update an existing activity row in the sheet. */
export async function updateActivity(
  accessToken: string,
  spreadsheetId: string,
  activity: Activity
): Promise<void> {
  const rowIndex = activity.rowIndex
  if (rowIndex == null) throw new Error('Activity has no rowIndex')
  const end_time = activity.end_time ?? ''
  await api<unknown>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A${rowIndex}:E${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[activity.id, activity.name, activity.duration_minutes, end_time, activity.created_at]],
      }),
    }
  )
}

/** Delete the row at the given 1-based sheet row index. */
export async function deleteActivity(
  accessToken: string,
  spreadsheetId: string,
  rowIndex: number
): Promise<void> {
  const sheetId = 0
  await api<unknown>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      }),
    }
  )
}
