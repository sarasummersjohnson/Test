// Server-side only. Column structure matches the client's existing content-
// calendar delivery template: Date, Pillar, Track, Visual Label,
// Visual/Template Needed, Caption, Notes.
//
// "Visual Label" and "Visual/Template Needed" describe what creative asset
// a post needs — a judgment call made by whoever's building the visuals,
// not something inferred from the pillar/caption alone — so those columns
// (and Notes) are left blank for manual completion after export.

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
    { header: 'Pillar', key: 'pillar', width: 22 },
    { header: 'Track', key: 'track', width: 14 },
    { header: 'Visual Label', key: 'visualLabel', width: 24 },
    { header: 'Visual/Template Needed', key: 'visualTemplateNeeded', width: 28 },
    { header: 'Caption', key: 'caption', width: 90 },
    { header: 'Notes', key: 'notes', width: 30 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    const addedRow = sheet.addRow({
      date: row.date,
      pillar: row.pillarLabel,
      track: row.category === 'membership' ? 'Membership' : 'Donor',
      visualLabel: '',
      visualTemplateNeeded: '',
      caption: row.caption,
      notes: '',
    })
    addedRow.alignment = { wrapText: true, vertical: 'top' }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
