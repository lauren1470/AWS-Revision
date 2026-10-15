import { describe, expect, it, vi } from 'vitest'
import { createDefaultAppData, validateBackup } from './database'
import { createFlashcardSession, flashcardShortcut, moveFlashcard, restoreFlashcardSession, saveFlashcardSession } from './flashcards'
import type { Term } from './types'

const timestamp = '2026-10-15T12:00:00.000Z'
const create = (ids = ['a', 'b', 'c']) => createFlashcardSession('cert', 'all', false, ids)
const term = (id: string, certificationId = 'cert'): Term => ({ id, term: id, definition: id, certificationIds: [certificationId], categoryIds: [], createdAt: timestamp, updatedAt: timestamp })

describe('flashcard sessions', () => {
  it('copies card order without modifying the source and shuffles only at creation', () => {
    const ids = ['a', 'b', 'c']
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const session = createFlashcardSession('cert', 'all', true, ids)
      expect(ids).toEqual(['a', 'b', 'c'])
      expect(session.termIds).toEqual(['b', 'c', 'a'])
      expect(moveFlashcard(session, 1).termIds).toEqual(session.termIds)
      expect(random).toHaveBeenCalledTimes(2)
    } finally {
      random.mockRestore()
    }
  })

  it('navigates within bounds, skips unrated cards, and finishes rather than looping', () => {
    const initial = create()
    expect(moveFlashcard(initial, -1)).toEqual(initial)
    const skipped = moveFlashcard(initial, 1)
    expect(skipped.index).toBe(1)
    expect(skipped.skippedTermIds).toEqual(['a'])
    const previous = moveFlashcard(skipped, -1)
    expect(previous.index).toBe(0)
    const rated = moveFlashcard(previous, 1, 'again')
    expect(rated.skippedTermIds).toEqual([])
    expect(rated.ratings).toEqual({ a: 'again' })
    const completed = moveFlashcard(moveFlashcard(rated, 1, 'good'), 1)
    expect(completed.completed).toBe(true)
    expect(completed.index).toBe(2)
    expect(completed.skippedTermIds).toEqual(['c'])
    expect(moveFlashcard(completed, 1)).toEqual(completed)
  })

  it('replaces ratings without double-counting history and preserves ratings when navigating', () => {
    let data = createDefaultAppData()
    const first = moveFlashcard(create(), 1, 'again')
    data = saveFlashcardSession(data, first, timestamp)
    const back = moveFlashcard(first, -1)
    data = saveFlashcardSession(data, back, timestamp)
    data = saveFlashcardSession(data, moveFlashcard(back, 1, 'easy'), timestamp)
    expect(data.flashcardProgress).toEqual([{ termId: 'a', again: 0, good: 0, easy: 1, lastReviewedAt: timestamp }])
    const sameRating = saveFlashcardSession(data, data.flashcardSessions![0], timestamp)
    expect(sameRating.flashcardProgress).toEqual(data.flashcardProgress)
    const newRound = moveFlashcard(create(), 1, 'good')
    data = saveFlashcardSession(data, newRound, timestamp)
    expect(data.flashcardProgress[0]).toMatchObject({ again: 0, good: 1, easy: 1 })
  })

  it('saves a separate session per certification and round while retaining the full set', () => {
    const initial = create()
    const round = createFlashcardSession('cert', 'all', false, ['a'], initial.fullTermIds)
    expect(round.fullTermIds).toEqual(['a', 'b', 'c'])
    expect(round.ratings).toEqual({})
    let data = saveFlashcardSession(createDefaultAppData(), initial, timestamp)
    data = saveFlashcardSession(data, createFlashcardSession('other', 'all', false, ['x']), timestamp)
    data = saveFlashcardSession(data, round, timestamp)
    expect(data.flashcardSessions).toHaveLength(2)
    expect(data.flashcardSessions?.find((session) => session.certificationId === 'cert')).toEqual(round)
  })

  it('restores JSON snapshots, drops deleted or reassigned cards, and handles an empty set', () => {
    const session = moveFlashcard(moveFlashcard(create(), 1, 'again'), 1)
    const snapshot = JSON.parse(JSON.stringify(session))
    expect(restoreFlashcardSession(snapshot, ['a', 'b', 'c'].map((id) => term(id)))).toEqual(session)
    const restored = restoreFlashcardSession(snapshot, [term('a'), term('b', 'other')])
    expect(restored.termIds).toEqual(['a'])
    expect(restored.index).toBe(0)
    expect(restored.ratings).toEqual({ a: 'again' })
    expect(restored.skippedTermIds).toEqual([])
    expect(restoreFlashcardSession(session, []).completed).toBe(true)
    const currentDeleted = { ...create(['a', 'b', 'c', 'd']), index: 1 }
    expect(restoreFlashcardSession(currentDeleted, [term('c'), term('d')]).index).toBe(0)
  })

  it('preserves old backups and validates the optional session data', () => {
    const data = createDefaultAppData()
    expect(validateBackup(data)).toBe(true)
    expect(validateBackup({ ...data, flashcardSessions: [create()] })).toBe(true)
    expect(validateBackup({ ...data, flashcardSessions: [{ ...create(), index: -1 }] })).toBe(false)
    expect(validateBackup({ ...data, flashcardSessions: [{ ...create(), ratings: { a: 'invalid' } }] })).toBe(false)
    expect(validateBackup({ ...data, flashcardSessions: [null] })).toBe(false)
  })

  it('maps shortcuts and prevents rating a hidden definition', () => {
    expect(flashcardShortcut(' ', false)).toBe('flip')
    expect(flashcardShortcut('ArrowLeft', false)).toBe('previous')
    expect(flashcardShortcut('ArrowRight', false)).toBe('next')
    for (const [key, rating] of [['1', 'again'], ['2', 'good'], ['3', 'easy']]) {
      expect(flashcardShortcut(key, false)).toBeUndefined()
      expect(flashcardShortcut(key, true)).toBe(rating)
    }
    expect(flashcardShortcut('Enter', true)).toBeUndefined()
  })
})
