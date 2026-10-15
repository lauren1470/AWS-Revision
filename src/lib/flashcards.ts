import type { AppData, FlashcardRating, FlashcardSession, Term } from './types'

export function flashcardShortcut(key: string, flipped: boolean): 'flip' | 'previous' | 'next' | FlashcardRating | undefined {
  if (key === ' ') return 'flip'
  if (key === 'ArrowLeft') return 'previous'
  if (key === 'ArrowRight') return 'next'
  if (!flipped) return undefined
  if (key === '1') return 'again'
  if (key === '2') return 'good'
  if (key === '3') return 'easy'
  return undefined
}

export function isFlashcardSession(value: unknown): value is FlashcardSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<FlashcardSession>
  const stringArray = (items: unknown): items is string[] => Array.isArray(items) && items.every((item) => typeof item === 'string')
  return typeof session.id === 'string' && typeof session.certificationId === 'string' &&
    typeof session.categoryId === 'string' && typeof session.shuffle === 'boolean' &&
    stringArray(session.termIds) && new Set(session.termIds).size === session.termIds.length &&
    stringArray(session.fullTermIds) && session.termIds.every((id) => session.fullTermIds?.includes(id)) &&
    typeof session.index === 'number' && Number.isInteger(session.index) && session.index >= 0 &&
    session.index < Math.max(1, session.termIds.length) &&
    typeof session.completed === 'boolean' && Boolean(session.ratings) &&
    typeof session.ratings === 'object' && !Array.isArray(session.ratings) &&
    Object.entries(session.ratings ?? {}).every(([id, rating]) => session.termIds?.includes(id) && ['again', 'good', 'easy'].includes(rating)) &&
    stringArray(session.skippedTermIds) && new Set(session.skippedTermIds).size === session.skippedTermIds.length &&
    session.skippedTermIds.every((id) => session.termIds?.includes(id) && !session.ratings?.[id])
}

export function createFlashcardSession(certificationId: string, categoryId: string, shuffle: boolean, termIds: string[], fullTermIds = termIds): FlashcardSession {
  const ordered = [...termIds]
  if (shuffle) {
    for (let index = ordered.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1))
      ;[ordered[index], ordered[other]] = [ordered[other], ordered[index]]
    }
  }
  return { id: crypto.randomUUID(), certificationId, categoryId, shuffle, termIds: ordered, fullTermIds: [...fullTermIds], index: 0, ratings: {}, skippedTermIds: [], completed: false }
}

export function restoreFlashcardSession(session: FlashcardSession, terms: Term[]): FlashcardSession {
  const available = new Set(terms.filter((term) => term.certificationIds.includes(session.certificationId)).map((term) => term.id))
  const termIds = session.termIds.filter((id) => available.has(id))
  const nextAvailableId = session.termIds.slice(session.index).find((id) => available.has(id))
  const currentIndex = nextAvailableId ? termIds.indexOf(nextAvailableId) : Math.max(0, termIds.length - 1)
  return {
    ...session,
    termIds,
    fullTermIds: session.fullTermIds.filter((id) => available.has(id)),
    index: currentIndex,
    ratings: Object.fromEntries(Object.entries(session.ratings).filter(([id]) => termIds.includes(id))),
    skippedTermIds: session.skippedTermIds.filter((id) => termIds.includes(id)),
    completed: session.completed || termIds.length === 0,
  }
}

export function moveFlashcard(session: FlashcardSession, direction: -1 | 1, rating?: FlashcardRating): FlashcardSession {
  const termId = session.termIds[session.index]
  if (!termId || session.completed || (direction === -1 && session.index === 0)) return session
  const ratings = rating ? { ...session.ratings, [termId]: rating } : session.ratings
  const skipped = new Set(session.skippedTermIds)
  if (ratings[termId]) skipped.delete(termId)
  else if (direction === 1) skipped.add(termId)
  return {
    ...session,
    ratings,
    skippedTermIds: [...skipped],
    index: Math.min(session.termIds.length - 1, session.index + direction),
    completed: direction === 1 && session.index === session.termIds.length - 1,
  }
}

export function saveFlashcardSession(data: AppData, session: FlashcardSession, timestamp: string): AppData {
  const sessions = data.flashcardSessions ?? []
  const previous = sessions.find((entry) => entry.certificationId === session.certificationId && entry.id === session.id)
  let progress = data.flashcardProgress
  for (const [termId, rating] of Object.entries(session.ratings)) {
    const oldRating = previous?.ratings[termId]
    if (oldRating === rating) continue
    const existing = progress.find((entry) => entry.termId === termId) ?? { termId, again: 0, good: 0, easy: 0, lastReviewedAt: timestamp }
    const updated = { ...existing, [rating]: existing[rating] + 1, lastReviewedAt: timestamp }
    if (oldRating) updated[oldRating] = Math.max(0, updated[oldRating] - 1)
    progress = [...progress.filter((entry) => entry.termId !== termId), updated]
  }
  return { ...data, flashcardProgress: progress, flashcardSessions: [...sessions.filter((entry) => entry.certificationId !== session.certificationId), session] }
}
