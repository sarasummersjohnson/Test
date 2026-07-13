// Server-side only. Column structure below is a reasonable default — no
// existing Excel template was provided, so this isn't matched to one. If
// you have a specific template (column names/order, extra fields like
// Platform or Status), adjust the `columns` list and the `sheet.addRow`
// call below; everything else in the calendar feature is independent of
// this file.

import ExcelJS from 'exceljs'

export type CalendarPostRow = {
  date: string // YYYY-MM-DD
  pillarLabel: string
  category: 'membership' | 'donor'
  caption: string
}

export async function buildCalendarWorkbook(rows: CalendarPostRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Nonprofit Caption Generator'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Posting Calendar')

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Content Pillar', key: 'pillar', width: 22 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Caption', key: 'caption', width: 90 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    const dateObj = new Date(`${row.date}T00:00:00Z`)
    const day = Number.isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })

    const addedRow = sheet.addRow({
      date: row.date,
      day,
      pillar: row.pillarLabel,
      category: row.category === 'membership' ? 'Membership' : 'Donor',
      caption: row.caption,
    })
    addedRow.alignment = { wrapText: true, vertical: 'top' }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
