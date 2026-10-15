import { describe, expect, it } from 'vitest'
import { calculateSubjectAreaInsights, filterTerms, answersAreCorrect, generateBalancedExam, toggleAnswerSelection } from './study'
import type { Question, Term } from './types'

const term: Term = {
  id: 's3',
  term: 'Amazon S3',
  definition: 'Object storage service.',
  certificationIds: ['cloud-practitioner'],
  categoryIds: ['storage'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('answersAreCorrect', () => {
  it('scores multi-select answers without relying on option order', () => {
    expect(answersAreCorrect(['C', 'A'], ['A', 'C'])).toBe(true)
    expect(answersAreCorrect(['A'], ['A', 'C'])).toBe(false)
    expect(answersAreCorrect(['A', 'B'], ['A', 'C'])).toBe(false)
  })
})

describe('toggleAnswerSelection', () => {
  it('allows selecting up to the question limit and deselecting an option', () => {
    expect(toggleAnswerSelection([], 'A', 2)).toEqual(['A'])
    expect(toggleAnswerSelection(['A'], 'B', 2)).toEqual(['A', 'B'])
    expect(toggleAnswerSelection(['A', 'B'], 'C', 2)).toEqual(['A', 'B'])
    expect(toggleAnswerSelection(['A', 'B'], 'A', 2)).toEqual(['B'])
  })
})

describe('filterTerms', () => {
  it('combines text, certification, and category filters', () => {
    expect(filterTerms([term], 'object', 'cloud-practitioner', 'storage')).toEqual([term])
    expect(filterTerms([term], 'object', 'other-certification', 'storage')).toEqual([])
    expect(filterTerms([term], 'queue', 'cloud-practitioner', 'all')).toEqual([])
  })

  const question = (id: string, subjectArea: string): Question => ({
    id,
    subjectArea,
    certificationId: 'cloud-practitioner',
    sourceExamId: 'source',
    sourceQuestionNumber: 1,
    prompt: id,
    options: [{ id: 'A', label: 'Answer' }, { id: 'B', label: 'Other' }],
    correctOptionIds: ['A'],
  })

  describe('question bank study insights', () => {
    const questions = [
      ...Array.from({ length: 40 }, (_, index) => question(`iam-${index}`, 'Identity and access management (IAM)')),
      ...Array.from({ length: 40 }, (_, index) => question(`compute-${index}`, 'Compute')),
    ]

    it('builds a requested-size exam containing every subject area', () => {
      const exam = generateBalancedExam(questions, 10)
      expect(exam).toHaveLength(10)
      expect(new Set(exam.map((item) => item.subjectArea))).toEqual(new Set(['Identity and access management (IAM)', 'Compute']))
    })

    it('calculates accuracy by subject area', () => {
      const insights = calculateSubjectAreaInsights([question('iam', 'Identity and access management (IAM)'), question('compute', 'Compute')], [{
        questionIds: ['iam', 'compute'],
        answers: { iam: ['A'], compute: ['B'] },
      }])
      expect(insights).toEqual([
        { subjectArea: 'Compute', answered: 1, correct: 0, accuracy: 0 },
        { subjectArea: 'Identity and access management (IAM)', answered: 1, correct: 1, accuracy: 1 },
      ])
    })
  })
})
