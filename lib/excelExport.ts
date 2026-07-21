// Server-side only. Columns match the client's content-calendar delivery
// template, extended for platform-specific captions and event phasing:
// Date, Phase, Pillar, Track, Visual Label, Visual/Template Needed,
// Caption_X, Caption_TikTok, Caption_Instagram, Caption_Facebook,
// Caption_LinkedIn, Notes.

import ExcelJS from 'exceljs'

export type CalendarPostRow = {
  date: string // YYYY-MM-DD
  phase: string
  pillarLabel: string
  category: 'membership' | 'donor' | 'event'
  visualTemplate: string
  visualLabel: string
  captionX: string
  captionTikTok: string
  captionInstagram: string
  captionFacebook: string
  captionLinkedin: string
  notes: string
}

function trackLabel(category: CalendarPostRow['category']): string {
  if (category === 'membership') return 'Membership'
  if (category === 'donor') return 'Donor'
  return 'Event'
}

export async function buildCalendarWorkbook(rows: CalendarPostRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Nonprofit Caption Generator'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Posting Calendar')

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Phase', key: 'phase', width: 14 },
    { header: 'Pillar', key: 'pillar', width: 22 },
    { header: 'Track', key: 'track', width: 12 },
    { header: 'Visual Label', key: 'visualLabel', width: 32 },
    { header: 'Visual/Template Needed', key: 'visualTemplate', width: 24 },
    { header: 'Caption_X', key: 'captionX', width: 40 },
    { header: 'Caption_TikTok', key: 'captionTikTok', width: 40 },
    { header: 'Caption_Instagram', key: 'captionInstagram', width: 40 },
    { header: 'Caption_Facebook', key: 'captionFacebook', width: 40 },
    { header: 'Caption_LinkedIn', key: 'captionLinkedin', width: 60 },
    { header: 'Notes', key: 'notes', width: 40 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    const addedRow = sheet.addRow({
      date: row.date,
      phase: row.phase,
      pillar: row.pillarLabel,
      track: trackLabel(row.category),
      visualLabel: row.visualLabel,
      visualTemplate: row.visualTemplate,
      captionX: row.captionX,
      captionTikTok: row.captionTikTok,
      captionInstagram: row.captionInstagram,
      captionFacebook: row.captionFacebook,
      captionLinkedin: row.captionLinkedin,
      notes: row.notes,
    })
    addedRow.alignment = { wrapText: true, vertical: 'top' }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
