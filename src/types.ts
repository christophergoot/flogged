export interface Activity {
  id: string
  name: string
  duration_minutes: number
  end_time: string | null
  created_at: string
  /** 1-based sheet row number (for delete). Set when loaded from Google Sheet. */
  rowIndex?: number
}

export interface ActivityInsert {
  name: string
  duration_minutes: number
  end_time?: string | null
}
