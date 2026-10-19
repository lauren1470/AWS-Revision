import type { Question, Term } from './types'

export const generatedExamQuestionCount = 75
export const generatedExamDurationSeconds = 90 * 60

export function answersAreCorrect(selected: string[] | undefined, correct: string[]): boolean {
  if (!selected || selected.length !== correct.length) {
    return false
  }

  return selected.every((option) => correct.includes(option))
}

export function toggleAnswerSelection(selected: string[], optionId: string, selectionLimit: number): string[] {
  if (selected.includes(optionId)) {
    return selected.filter((id) => id !== optionId)
  }
  if (selected.length >= selectionLimit) {
    return selected
  }
  return [...selected, optionId]
}

export function filterTerms(terms: Term[], query: string, certificationId: string, categoryId: string): Term[] {
  const normalizedQuery = query.trim().toLowerCase()

  return terms.filter((term) => {
    const matchesQuery =
      !normalizedQuery ||
      term.term.toLowerCase().includes(normalizedQuery) ||
      term.definition.toLowerCase().includes(normalizedQuery)
    const matchesCertification = certificationId === 'all' || term.certificationIds.includes(certificationId)
    const matchesCategory = categoryId === 'all' || term.categoryIds.includes(categoryId)
    return matchesQuery && matchesCertification && matchesCategory
  })
}

export type TermSortOrder = 'term-asc' | 'term-desc' | 'newest' | 'oldest'

export function sortTerms(terms: Term[], sortOrder: TermSortOrder): Term[] {
  return [...terms].sort((left, right) => {
    if (sortOrder === 'newest' || sortOrder === 'oldest') {
      const dateOrder = Date.parse(left.createdAt) - Date.parse(right.createdAt)
      const orderedDate = sortOrder === 'newest' ? -dateOrder : dateOrder
      return orderedDate || left.term.localeCompare(right.term, undefined, { sensitivity: 'base', numeric: true })
    }

    const termOrder = left.term.localeCompare(right.term, undefined, { sensitivity: 'base', numeric: true })
    return sortOrder === 'term-asc' ? termOrder : -termOrder
  })
}

export function filterQuestions(questions: Question[], certificationId: string, categoryId = 'all'): Question[] {
  return questions.filter(
    (question) =>
      question.certificationId === certificationId &&
      (categoryId === 'all' || question.categoryIds?.includes(categoryId)),
  )
}

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

export function generateBalancedExam(questions: Question[], count = generatedExamQuestionCount): Question[] {
  if (questions.length < count) {
    throw new Error(`At least ${count} questions are required to generate an exam.`)
  }
  const groups = new Map<string, Question[]>()
  questions.forEach((question) => {
    const group = groups.get(question.subjectArea) ?? []
    group.push(question)
    groups.set(question.subjectArea, group)
  })
  const selected = [...groups.values()].flatMap((group) => shuffled(group).slice(0, 1))
  const remaining = shuffled(questions.filter((question) => !selected.some((picked) => picked.id === question.id)))
  return shuffled([...selected, ...remaining.slice(0, count - selected.length)])
}

export interface SubjectAreaInsight {
  subjectArea: string
  answered: number
  correct: number
  accuracy: number | null
}

export function calculateSubjectAreaInsights(questions: Question[], attempts: Array<{ questionIds: string[]; answers: Record<string, string[]> }>): SubjectAreaInsight[] {
  const questionById = new Map(questions.map((question) => [question.id, question]))
  const results = new Map<string, { answered: number; correct: number }>()
  attempts.forEach((attempt) => attempt.questionIds.forEach((questionId) => {
    const question = questionById.get(questionId)
    if (!question) return
    const current = results.get(question.subjectArea) ?? { answered: 0, correct: 0 }
    current.answered += 1
    if (answersAreCorrect(attempt.answers[questionId], question.correctOptionIds)) current.correct += 1
    results.set(question.subjectArea, current)
  }))
  return [...new Set(questions.map((question) => question.subjectArea))].sort().map((subjectArea) => {
    const result = results.get(subjectArea) ?? { answered: 0, correct: 0 }
    return { subjectArea, ...result, accuracy: result.answered ? result.correct / result.answered : null }
  })
}
