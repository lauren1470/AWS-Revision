import { useEffect, useRef, useState } from 'react'
import { createFlashcardSession, flashcardShortcut, moveFlashcard, restoreFlashcardSession } from './lib/flashcards'
import type { Category, FlashcardRating, FlashcardSession, Term } from './lib/types'

const ratingLabels: Record<FlashcardRating, string> = { again: 'Again', good: 'Good', easy: 'Easy' }

export function Flashcards({ terms, categories, certificationId, savedSession, onChange, onClear, onNotice }: {
  terms: Term[]
  categories: Category[]
  certificationId: string
  savedSession?: FlashcardSession
  onChange: (session: FlashcardSession) => void
  onClear: () => void
  onNotice: (message: string) => void
}) {
  const [session, setSession] = useState(() => savedSession ? restoreFlashcardSession(savedSession, terms) : undefined)
  const [mode, setMode] = useState<'setup' | 'resume' | 'active' | 'summary'>(() => savedSession ? restoreFlashcardSession(savedSession, terms).completed ? 'summary' : 'resume' : 'setup')
  const [categoryId, setCategoryId] = useState(savedSession && categories.some((category) => category.id === savedSession.categoryId) ? savedSession.categoryId : 'all')
  const [shuffle, setShuffle] = useState(savedSession?.shuffle ?? false)
  const [flipped, setFlipped] = useState(false)
  const notified = useRef(false)
  const selected = terms.filter((term) => categoryId === 'all' || term.categoryIds.includes(categoryId))
  const card = terms.find((term) => term.id === session?.termIds[session.index])

  useEffect(() => {
    if (!notified.current && savedSession) {
      const restored = restoreFlashcardSession(savedSession, terms)
      if (restored.termIds.length !== savedSession.termIds.length || restored.fullTermIds.length !== savedSession.fullTermIds.length) {
        notified.current = true
        onChange(restored)
        onNotice('Some cards in your saved session are no longer available and have been removed from this session.')
      }
    }
  }, [onChange, onNotice, savedSession, terms])

  function store(next: FlashcardSession) {
    setSession(next)
    onChange(next)
    setFlipped(false)
    setMode(next.completed ? 'summary' : 'active')
  }

  function start(termIds: string[], fullTermIds = termIds) {
    if (!termIds.length) {
      onNotice('No cards are available for this session. Choose another category or add terminology.')
      return
    }
    store(createFlashcardSession(certificationId, categoryId, shuffle, termIds, fullTermIds))
  }

  function move(direction: -1 | 1, rating?: FlashcardRating) {
    if (session) store(moveFlashcard(session, direction, rating))
  }

  useEffect(() => {
    if (mode !== 'active' || !card || !session) return
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      if (event.key === ' ' && target instanceof HTMLElement && target.closest('button')) return
      const action = flashcardShortcut(event.key, flipped)
      if (action === 'flip') {
        event.preventDefault()
        setFlipped((value) => !value)
      } else if (action === 'previous' || action === 'next') {
        event.preventDefault()
        move(action === 'previous' ? -1 : 1)
      } else if (action) {
        event.preventDefault()
        move(1, action)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const rated = session ? Object.keys(session.ratings).length : 0
  const skipped = session?.skippedTermIds.length ?? 0
  const remaining = (session?.termIds.length ?? 0) - rated - skipped

  return <section className="flashcards-page">
    <div className="page-heading"><div><p className="eyebrow">Self-rated review</p><h1>Flashcards</h1></div></div>
    {mode === 'setup' && <div className="section-card flashcard-setup">
      <h2>Set up your session</h2>
      <label>Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        <option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select></label>
      <label className="check"><input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />Shuffle cards</label>
      <p>{selected.length} cards available. Each session uses all matching cards.</p>
      <button type="button" className="primary" disabled={!selected.length} onClick={() => start(selected.map((term) => term.id))}>Start session</button>
      {!selected.length && <p className="helper">Choose another category or add terminology for this certification.</p>}
    </div>}
    {mode === 'resume' && session && <div className="section-card">
      <h2>You have a saved flashcard session</h2>
      <p>{session.termIds.length} cards · {rated} rated · {skipped} skipped</p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => store(session)}>Continue session</button>
        <button type="button" onClick={() => {
          if (window.confirm('Start a new session? Your unfinished session will be replaced. Ratings already recorded will be kept.')) {
            onClear()
            setSession(undefined)
            setMode('setup')
          }
        }}>Start a new session</button>
      </div>
    </div>}
    {mode === 'active' && session && card && <>
      <div className="flashcard-progress" role="status">
        <strong>Card {session.index + 1} of {session.termIds.length}</strong>
        <p>{rated} rated · {skipped} skipped · {remaining} remaining</p>
        <progress aria-label="Session progress" value={rated + skipped} max={session.termIds.length} />
      </div>
      <button type="button" className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-pressed={flipped} aria-keyshortcuts="Space">
        <span className="eyebrow">{flipped ? 'Definition' : 'Term'} · Click or Space to flip</span>
        <strong>{flipped ? card.definition : card.term}</strong>
        {flipped && card.notes && <small>{card.notes}</small>}
      </button>
      <p className="helper">Current rating: {session.ratings[card.id] ? ratingLabels[session.ratings[card.id]] : session.skippedTermIds.includes(card.id) ? 'Skipped' : 'Not rated'}</p>
      <div className="rating-actions" aria-label="Rate this flashcard">
        {(Object.entries(ratingLabels) as [FlashcardRating, string][]).map(([rating, label], index) => <button type="button" key={rating} disabled={!flipped} aria-pressed={session.ratings[card.id] === rating} onClick={() => move(1, rating)}>{label} ({index + 1})</button>)}
      </div>
      <div className="actions">
        <button type="button" disabled={session.index === 0} onClick={() => move(-1)}>Previous (←)</button>
        <button type="button" onClick={() => move(1)}>{session.index === session.termIds.length - 1 ? 'Finish session' : 'Next'} (→)</button>
      </div>
      <p className="helper">Reveal the definition to rate. Ratings advance automatically. Next skips unrated cards. Progress saves automatically.</p>
    </>}
    {mode === 'summary' && session && <div className="section-card">
      <h2>Session complete</h2>
      <p>{session.termIds.length} cards · {rated} rated · {skipped} skipped</p>
      <div className="insight-grid">
        {Object.entries(ratingLabels).map(([rating, label]) => <div key={rating}><strong>{Object.values(session.ratings).filter((value) => value === rating).length}</strong><span>{label}</span></div>)}
        <div><strong>{skipped}</strong><span>Skipped</span></div>
      </div>
      {!session.termIds.length && <p>No cards from this session are still available. Your previous review history is preserved.</p>}
      <div className="actions">
        <button type="button" disabled={!session.fullTermIds.length} onClick={() => start(session.fullTermIds)}>Restart full set</button>
        <button type="button" disabled={!Object.values(session.ratings).includes('again')} onClick={() => start(session.termIds.filter((id) => session.ratings[id] === 'again'), session.fullTermIds)}>Review Again cards</button>
        <button type="button" disabled={!skipped} onClick={() => start(session.skippedTermIds, session.fullTermIds)}>Review skipped cards</button>
        <button type="button" onClick={() => { onClear(); setSession(undefined); setMode('setup') }}>Back to setup</button>
      </div>
    </div>}
  </section>
}
