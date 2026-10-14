import { describe, expect, it } from 'vitest'
import { exportTermsCsv, importTermsCsv, terminologyCsvHeader } from './csv'
import type { Term } from './types'

describe('terminology CSV', () => {
  it('imports valid data and reports invalid rows', () => {
    const csv = `${terminologyCsvHeader.join(',')}\nS3,Object storage,,AWS,cloud-practitioner,storage\nMissing definition,,,AWS,cloud-practitioner,`
    const result = importTermsCsv(csv)
    expect(result.terms).toHaveLength(1)
    expect(result.terms[0].term).toBe('S3')
    expect(result.errors).toEqual(['Row 3: term, definition, and certificationIds are required.'])
  })

  it('round-trips quoted fields', () => {
    const term: Term = {
      id: 's3',
      term: 'Amazon S3',
      definition: 'Object storage, with "buckets".',
      certificationIds: ['cloud-practitioner'],
      categoryIds: ['storage'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const result = importTermsCsv(exportTermsCsv([term]))
    expect(result.errors).toEqual([])
    expect(result.terms[0].definition).toBe(term.definition)
  })
})
