import { describe, expect, it } from 'vitest'
import { calculateSubjectAreaInsights, filterTerms, answersAreCorrect, generateBalancedExam, sortCategories, sortTerms, toggleAnswerSelection } from './study'
import type { Category, Question, Term } from './types'

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

describe('sortTerms', () => {
  const terms: Term[] = [
    { ...term, id: 's3', term: 'Amazon S3', createdAt: '2026-01-03T00:00:00.000Z' },
    { ...term, id: 'iam', term: 'IAM', createdAt: '2026-01-01T00:00:00.000Z' },
    { ...term, id: 'ec2', term: 'Amazon EC2', createdAt: '2026-01-02T00:00:00.000Z' },
  ]

  it('sorts alphabetically in both directions', () => {
    expect(sortTerms(terms, 'term-asc').map((item) => item.id)).toEqual(['ec2', 's3', 'iam'])
    expect(sortTerms(terms, 'term-desc').map((item) => item.id)).toEqual(['iam', 's3', 'ec2'])
  })

  it('sorts by date added in both directions', () => {
    expect(sortTerms(terms, 'newest').map((item) => item.id)).toEqual(['s3', 'ec2', 'iam'])
    expect(sortTerms(terms, 'oldest').map((item) => item.id)).toEqual(['iam', 'ec2', 's3'])
  })
})

describe('sortCategories', () => {
  it('sorts names alphabetically without changing the input array', () => {
    const categories: Category[] = [
      { id: 'storage', name: 'Storage', description: '', color: '', certificationIds: [] },
      { id: 'compute', name: 'compute', description: '', color: '', certificationIds: [] },
      { id: 'cloud', name: 'Cloud concepts', description: '', color: '', certificationIds: [] },
    ]

    expect(sortCategories(categories).map((category) => category.name)).toEqual(['Cloud concepts', 'compute', 'Storage'])
    expect(categories.map((category) => category.name)).toEqual(['Storage', 'compute', 'Cloud concepts'])
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
