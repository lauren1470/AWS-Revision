import type { Term } from './types'

export const terminologyCsvHeader = ['term', 'definition', 'notes', 'source', 'certificationIds', 'categoryIds'] as const

export interface CsvImportResult {
  terms: Array<Omit<Term, 'id' | 'createdAt' | 'updatedAt'>>
  errors: string[]
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += character
    }
  }
  cells.push(current.trim())
  return cells
}

export function importTermsCsv(csv: string): CsvImportResult {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) {
    return { terms: [], errors: ['The CSV file is empty.'] }
  }
  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase())
  if (header.join(',') !== terminologyCsvHeader.map((column) => column.toLowerCase()).join(',')) {
    return { terms: [], errors: [`The header must be: ${terminologyCsvHeader.join(',')}`] }
  }

  const terms: CsvImportResult['terms'] = []
  const errors: string[] = []
  lines.slice(1).forEach((line, index) => {
    const row = parseCsvLine(line)
    const [term, definition, notes, source, certifications, categories] = row
    if (row.length !== terminologyCsvHeader.length || !term || !definition || !certifications) {
      errors.push(`Row ${index + 2}: term, definition, and certificationIds are required.`)
      return
    }
    terms.push({
      term,
      definition,
      notes: notes || undefined,
      source: source || undefined,
      certificationIds: certifications.split('|').filter(Boolean),
      categoryIds: categories?.split('|').filter(Boolean) ?? [],
    })
  })
  return { terms, errors }
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function exportTermsCsv(terms: Term[]): string {
  const rows = terms.map((term) =>
    [term.term, term.definition, term.notes ?? '', term.source ?? '', term.certificationIds.join('|'), term.categoryIds.join('|')]
      .map(escapeCsv)
      .join(','),
  )
  return [terminologyCsvHeader.join(','), ...rows].join('\n')
}
