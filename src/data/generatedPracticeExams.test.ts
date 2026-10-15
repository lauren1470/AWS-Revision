import { describe, expect, it } from 'vitest'
import { generatedQuestions } from './generatedPracticeExams'

describe('generated practice exam answers', () => {
  it('preserves every answer for questions that specify two selections', () => {
    const questions = generatedQuestions.filter((question) => /choose two\b/i.test(question.prompt))

    expect(questions.length).toBeGreaterThan(0)
    expect(questions.every((question) => question.correctOptionIds.length === 2)).toBe(true)
  })
})
