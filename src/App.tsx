import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Flashcards } from './Flashcards'
import { saveFlashcardSession } from './lib/flashcards'
import { generatedQuestions } from './data/generatedPracticeExams'
import { exportTermsCsv, importTermsCsv, terminologyCsvHeader } from './lib/csv'
import { loadAppData, requestPersistentStorage, saveAppData, validateBackup } from './lib/database'
import { answersAreCorrect, calculateSubjectAreaInsights, filterQuestions, filterTerms, generateBalancedExam, generatedExamDurationSeconds, generatedExamQuestionCount, sortTerms, toggleAnswerSelection, type TermSortOrder } from './lib/study'
import type { AppData, Category, Certification, ExamAttempt, InProgressExam, Question, Term } from './lib/types'
import { themes } from './lib/types'

type View = 'dashboard' | 'glossary' | 'flashcards' | 'exams' | 'settings'

const navItems: Array<[View, string]> = [
  ['dashboard', 'Dashboard'],
  ['glossary', 'Glossary'],
  ['flashcards', 'Flashcards'],
  ['exams', 'Practice exams'],
  ['settings', 'Settings'],
]

function now() {
  return new Date().toISOString()
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function download(name: string, content: string, type: string) {
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(new Blob([content], { type }))
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [view, setView] = useState<View>('dashboard')
  const [notice, setNotice] = useState('')
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null)

  useEffect(() => {
    void loadAppData()
      .then(setData)
      .catch((error: Error) => setNotice(error.message))
    void requestPersistentStorage()
      .then(setStoragePersistent)
      .catch(() => setStoragePersistent(false))
  }, [])

  const theme = data?.theme ?? 'blue'
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('aws-revision-hub-theme', theme)
  }, [theme])

  async function persist(next: AppData) {
    setData(next)
    try {
      await saveAppData(next)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save local study data.')
    }
  }

  if (!data) {
    return <main className="loading">Loading your private study workspace…</main>
  }

  const activeCertification =
    data.certifications.find((certification) => certification.id === data.activeCertificationId) ?? data.certifications[0]
  const activeQuestions = filterQuestions(generatedQuestions, activeCertification.id)
  const savedExam = data.inProgressExam?.certificationId === activeCertification.id ? data.inProgressExam : undefined

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#dashboard" onClick={() => setView('dashboard')}>
          <span aria-hidden="true">☁</span> AWS Revision Hub
        </a>
        <label className="certification-picker">
          <span>Studying for</span>
          <select
            value={activeCertification.id}
            onChange={(event) => void persist({ ...data, activeCertificationId: event.target.value })}
          >
            {data.certifications.filter((certification) => certification.active).map((certification) => (
              <option key={certification.id} value={certification.id}>
                {certification.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="layout">
        <nav aria-label="Main navigation">
          {navItems.map(([id, label]) => (
            <button key={id} type="button" className={view === id ? 'nav-active' : ''} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <main>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">
                ×
              </button>
            </div>
          )}
          {view === 'dashboard' && (
            <Dashboard
              certificationName={activeCertification.name}
              terms={data.terms.filter((term) => term.certificationIds.includes(activeCertification.id))}
              questionCount={activeQuestions.length}
              questions={activeQuestions}
              attempts={data.examAttempts.filter((attempt) => attempt.certificationId === activeCertification.id)}
              progressCount={data.flashcardProgress.length}
              hasInProgressExam={Boolean(savedExam)}
              onNavigate={setView}
            />
          )}
          {view === 'glossary' && (
            <Glossary
              data={data}
              activeCertificationId={activeCertification.id}
              onSave={persist}
              onNotice={setNotice}
            />
          )}
          {view === 'flashcards' && (
            <Flashcards
              key={activeCertification.id}
              terms={data.terms.filter((term) => term.certificationIds.includes(activeCertification.id))}
              categories={data.categories.filter((category) => category.certificationIds.includes(activeCertification.id))}
              certificationId={activeCertification.id}
              savedSession={data.flashcardSessions?.find((session) => session.certificationId === activeCertification.id)}
              onChange={(session) => void persist(saveFlashcardSession(data, session, now()))}
              onClear={() => void persist({ ...data, flashcardSessions: data.flashcardSessions?.filter((session) => session.certificationId !== activeCertification.id) })}
              onNotice={setNotice}
            />
          )}
          {view === 'exams' && (
            <PracticeExams
              questions={activeQuestions}
              certificationId={activeCertification.id}
              savedExam={savedExam}
              onExamChange={(inProgressExam) => void persist({ ...data, inProgressExam })}
              onSaveAttempt={(attempt) => void persist({ ...data, inProgressExam: undefined, examAttempts: [attempt, ...data.examAttempts] })}
            />
          )}
          {view === 'settings' && <Settings data={data} storagePersistent={storagePersistent} onSave={persist} onNotice={setNotice} />}
        </main>
      </div>
    </div>
  )
}

function Dashboard({
  certificationName,
  terms,
  questionCount,
  questions,
  attempts,
  progressCount,
  hasInProgressExam,
  onNavigate,
}: {
  certificationName: string
  terms: Term[]
  questionCount: number
  questions: Question[]
  attempts: ExamAttempt[]
  progressCount: number
  hasInProgressExam: boolean
  onNavigate: (view: View) => void
}) {
  const latest = attempts[0]
  const coveredQuestions = new Set(attempts.flatMap((attempt) => attempt.questionIds)).size
  const insights = calculateSubjectAreaInsights(questions, attempts).filter((insight) => insight.answered > 0)
  const weakest = [...insights].sort((left, right) => (left.accuracy ?? 1) - (right.accuracy ?? 1))[0]
  return (
    <>
      <section className="hero-panel">
        <p className="eyebrow">Active certification</p>
        <h1>{certificationName}</h1>
        <p>Build confidence with your own glossary, flashcards, and practice exam results.</p>
        <div className="actions">
          <button type="button" className="primary" onClick={() => onNavigate('exams')}>{hasInProgressExam ? 'Continue or start a practice exam' : 'Start a practice exam'}</button>
          <button type="button" onClick={() => onNavigate('glossary')}>Add terminology</button>
        </div>
      </section>
      <section className="stat-grid" aria-label="Study progress">
        <article><strong>{terms.length}</strong><span>Terminology entries</span></article>
        <article><strong>{coveredQuestions}/{questionCount}</strong><span>Question bank covered</span></article>
        <article><strong>{progressCount}</strong><span>Cards reviewed</span></article>
        <article><strong>{attempts.length}</strong><span>Completed attempts</span></article>
      </section>
      <section className="section-card">
        <h2>Recent practice</h2>
        {latest ? (
          <p>
            Your latest result: <strong>{latest.score}/{latest.total}</strong> ({Math.round((latest.score / latest.total) * 100)}%)
            {' · '}{new Date(latest.completedAt).toLocaleDateString()}
          </p>
        ) : <p>No completed practice attempts yet. Select an exam to get started.</p>}
      </section>
      <section className="section-card">
        <h2>Where to focus next</h2>
        {weakest ? <p><strong>{weakest.subjectArea}</strong> is your lowest-scoring covered area at {Math.round((weakest.accuracy ?? 0) * 100)}% across {weakest.answered} questions.</p> : <p>Complete an exam to identify subject areas that need more work.</p>}
      </section>
    </>
  )
}

function Glossary({
  data,
  activeCertificationId,
  onSave,
  onNotice,
}: {
  data: AppData
  activeCertificationId: string
  onSave: (data: AppData) => Promise<void>
  onNotice: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [sortOrder, setSortOrder] = useState<TermSortOrder>('term-asc')
  const [editing, setEditing] = useState<Term | null>(null)
  const terms = sortTerms(filterTerms(data.terms, query, activeCertificationId, categoryId), sortOrder)

  function saveTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const term = String(form.get('term') ?? '').trim()
    const definition = String(form.get('definition') ?? '').trim()
    if (!term || !definition) {
      onNotice('A term and its definition are required.')
      return
    }
    const timestamp = now()
    const categoryIds = form.getAll('categoryIds').map(String)
    const selectedCategories = data.categories
      .filter((category) => categoryIds.includes(category.id))
      .map((category) => category.id)
    let categories = data.categories
    const newCategoryName = String(form.get('newCategory') ?? '').trim()
    if (newCategoryName) {
      const existing = data.categories.find((category) => category.name.toLowerCase() === newCategoryName.toLowerCase() && category.certificationIds.includes(activeCertificationId))
      const category: Category = existing ?? { id: createId('category'), name: newCategoryName, description: '', color: '#2563eb', certificationIds: [activeCertificationId] }
      if (!existing) categories = [...categories, category]
      if (!selectedCategories.includes(category.id)) selectedCategories.push(category.id)
    }
    const entry: Term = {
      id: editing?.id ?? createId('term'),
      term,
      definition,
      notes: String(form.get('notes') ?? '').trim() || undefined,
      source: String(form.get('source') ?? '').trim() || undefined,
      certificationIds: [activeCertificationId],
      categoryIds: selectedCategories,
      createdAt: editing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    void onSave({ ...data, categories, terms: editing ? data.terms.map((item) => item.id === entry.id ? entry : item) : [...data.terms, entry] })
    setEditing(null)
    event.currentTarget.reset()
  }

  async function importCsv(file: File) {
    const result = importTermsCsv(await file.text())
    const timestamp = now()
    const validTerms = result.terms.map((term) => ({ ...term, id: createId('term'), createdAt: timestamp, updatedAt: timestamp }))
    if (validTerms.length) {
      await onSave({ ...data, terms: [...data.terms, ...validTerms] })
    }
    onNotice(result.errors.length ? `Imported ${validTerms.length} terms. ${result.errors.join(' ')}` : `Imported ${validTerms.length} terms.`)
  }

  return (
    <div className="page-grid">
      <section>
        <div className="page-heading"><div><p className="eyebrow">Personal knowledge base</p><h1>Glossary</h1></div>
          <button type="button" onClick={() => download('aws-terminology.csv', exportTermsCsv(data.terms), 'text/csv')}>Export CSV</button>
        </div>
        <div className="filters">
          <input aria-label="Search terminology" placeholder="Search terms or definitions" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="Filter by category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="all">All categories</option>
            {data.categories.filter((category) => category.certificationIds.includes(activeCertificationId)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select aria-label="Sort terminology" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as TermSortOrder)}>
            <option value="term-asc">A-Z</option>
            <option value="term-desc">Z-A</option>
            <option value="newest">Newest added</option>
            <option value="oldest">Oldest added</option>
          </select>
          <label className="file-button">Import CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file) }} /></label>
        </div>
        <p className="helper">Expected CSV headers: <code>{terminologyCsvHeader.join(',')}</code></p>
        <div className="term-list">
          {terms.length ? terms.map((term) => (
            <article className="term-card" key={term.id}>
              <div><h2>{term.term}</h2><p>{term.definition}</p>{term.notes && <small>{term.notes}</small>}{term.categoryIds.length > 0 && <div className="category-tags">{term.categoryIds.map((id) => data.categories.find((category) => category.id === id)).filter((category) => category !== undefined).map((category) => <button type="button" className="category-tag" key={category.id} onClick={() => setCategoryId(category.id)} title="Show only this category">{category.name}</button>)}</div>}</div>
              <div className="inline-actions">
                <button type="button" onClick={() => setEditing(term)}>Edit</button>
                <button type="button" className="danger" onClick={() => void onSave({ ...data, terms: data.terms.filter((item) => item.id !== term.id) })}>Delete</button>
              </div>
            </article>
          )) : <p className="empty">No terms match these filters. Add one below or import a CSV.</p>}
        </div>
      </section>
      <TermForm editing={editing} categories={data.categories.filter((category) => category.certificationIds.includes(activeCertificationId))} onSubmit={saveTerm} onCancel={() => setEditing(null)} />
    </div>
  )
}

function TermForm({ editing, categories, onSubmit, onCancel }: { editing: Term | null; categories: Category[]; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <aside className="section-card form-card"><h2>{editing ? 'Edit terminology' : 'Add terminology'}</h2>
    <form key={editing?.id ?? 'new'} onSubmit={onSubmit}>
      <label>Term<input name="term" required defaultValue={editing?.term} /></label>
      <label>Definition<textarea name="definition" required defaultValue={editing?.definition} /></label>
      <label>Notes (optional)<textarea name="notes" defaultValue={editing?.notes} /></label>
      <label>Source (optional)<input name="source" defaultValue={editing?.source} /></label>
      <fieldset><legend>Categories</legend>{categories.length === 0 && <p className="helper">No categories yet. Type one below to create it.</p>}{categories.map((category) => <label className="check" key={category.id}><input type="checkbox" name="categoryIds" value={category.id} defaultChecked={editing?.categoryIds.includes(category.id)} />{category.name}</label>)}</fieldset>
      <label>New category (optional)<input name="newCategory" placeholder="e.g. Serverless" /></label>
      <div className="actions"><button className="primary" type="submit">Save term</button>{editing && <button type="button" onClick={onCancel}>Cancel</button>}</div>
    </form>
  </aside>
}

type ExamSession = { questions: Question[]; answers: Record<string, string[]>; flaggedQuestionIds: string[]; startedAt: string }

function restoreSession(savedExam: InProgressExam | undefined, questions: Question[]): ExamSession | null {
  if (!savedExam) return null
  const questionById = new Map(questions.map((question) => [question.id, question]))
  const restored = savedExam.questionIds.flatMap((id) => questionById.get(id) ?? [])
  return restored.length ? { ...savedExam, questions: restored } : null
}

function PracticeExams({ questions, certificationId, savedExam, onExamChange, onSaveAttempt }: { questions: Question[]; certificationId: string; savedExam?: InProgressExam; onExamChange: (exam: InProgressExam | undefined) => void; onSaveAttempt: (attempt: ExamAttempt) => void }) {
  const [session, setSessionState] = useState<ExamSession | null>(null)
  const [result, setResult] = useState<ExamAttempt | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(generatedExamDurationSeconds)
  const submissionStarted = useRef(false)
  const sessionQuestions = session?.questions ?? []

  function setSession(next: ExamSession) {
    setSessionState(next)
    onExamChange({ certificationId, questionIds: next.questions.map((question) => question.id), answers: next.answers, flaggedQuestionIds: next.flaggedQuestionIds, startedAt: next.startedAt })
  }

  useEffect(() => {
    if (!session) return
    const updateRemaining = () => {
      const remaining = Math.max(0, generatedExamDurationSeconds - Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))
      setRemainingSeconds(remaining)
      if (remaining === 0 && !submissionStarted.current) {
        submissionStarted.current = true
        const score = session.questions.filter((question) => answersAreCorrect(session.answers[question.id], question.correctOptionIds)).length
        const attempt: ExamAttempt = { id: createId('attempt'), certificationId, questionIds: session.questions.map((question) => question.id), answers: session.answers, flaggedQuestionIds: session.flaggedQuestionIds, startedAt: session.startedAt, completedAt: now(), score, total: session.questions.length }
        onSaveAttempt(attempt)
        setResult(attempt)
      }
    }
    updateRemaining()
    const interval = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(interval)
  }, [certificationId, onSaveAttempt, session])

  function start() {
    setSession({ questions: generateBalancedExam(questions), answers: {}, flaggedQuestionIds: [], startedAt: now() })
    setResult(null)
    setRemainingSeconds(generatedExamDurationSeconds)
    submissionStarted.current = false
  }
  function toggle(question: Question, optionId: string) {
    if (!session) return
    const current = session.answers[question.id] ?? []
    const next = question.correctOptionIds.length === 1
      ? [optionId]
      : toggleAnswerSelection(current, optionId, question.correctOptionIds.length)
    setSession({ ...session, answers: { ...session.answers, [question.id]: next } })
  }
  function toggleFlag(questionId: string) {
    if (!session) return
    const flaggedQuestionIds = session.flaggedQuestionIds.includes(questionId)
      ? session.flaggedQuestionIds.filter((id) => id !== questionId)
      : [...session.flaggedQuestionIds, questionId]
    setSession({ ...session, flaggedQuestionIds })
  }
  function submit() {
    if (!session || submissionStarted.current) return
    submissionStarted.current = true
    const score = session.questions.filter((question) => answersAreCorrect(session.answers[question.id], question.correctOptionIds)).length
    const attempt: ExamAttempt = { id: createId('attempt'), certificationId, questionIds: session.questions.map((question) => question.id), answers: session.answers, flaggedQuestionIds: session.flaggedQuestionIds, startedAt: session.startedAt, completedAt: now(), score, total: session.questions.length }
    onSaveAttempt(attempt)
    setResult(attempt)
  }

  const restoredSession = restoreSession(savedExam, questions)

  if (result) return <ExamResults attempt={result} questions={sessionQuestions} onBack={() => { setResult(null); setSessionState(null) }} />
  if (session) return <section className="exam-session"><div className="page-heading"><div><p className="eyebrow">Time remaining: {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</p><h1>75-question practice exam</h1><p className="helper">{Object.keys(session.answers).length}/75 answered · {session.flaggedQuestionIds.length} flagged for review · Progress saves automatically</p></div><div className="actions"><button type="button" onClick={() => { if (window.confirm('Discard this exam? Your answers will not be scored.')) { setSessionState(null); onExamChange(undefined) } }}>Discard exam</button><button type="button" className="primary" onClick={submit}>Submit answers</button></div></div>
    {session.questions.map((question, index) => { const selected = session.answers[question.id] ?? []; const selectionLimit = question.correctOptionIds.length; return <article className="question-card" key={question.id}><div className="question-heading"><div><p className="eyebrow">{question.subjectArea}</p><h2>{index + 1}. {question.prompt}</h2></div><button type="button" className={session.flaggedQuestionIds.includes(question.id) ? 'flagged' : ''} onClick={() => toggleFlag(question.id)} aria-pressed={session.flaggedQuestionIds.includes(question.id)}>{session.flaggedQuestionIds.includes(question.id) ? 'Flagged for review' : 'Flag for review'}</button></div><p className="helper">{selectionLimit === 1 ? 'Choose one answer.' : `Choose ${selectionLimit} answers.`}</p>
      {question.options.map((option) => { const isSelected = selected.includes(option.id); return <label className="option" key={option.id}><input type={selectionLimit === 1 ? 'radio' : 'checkbox'} name={question.id} checked={isSelected} disabled={selectionLimit > 1 && !isSelected && selected.length >= selectionLimit} onChange={() => toggle(question, option.id)} /> <strong>{option.id}.</strong> {option.label}</label> })}
    </article> })}</section>

  if (restoredSession) {
    return <section><div className="page-heading"><div><p className="eyebrow">Unfinished exam</p><h1>Practice exams</h1></div></div>
      <div className="section-card exam-setup"><h2>You have an exam in progress</h2>
        <p>Your answers and flagged questions are saved. Continue where you left off, or start a new exam and discard this progress.</p>
        <div className="actions">
          <button type="button" className="primary" onClick={() => setSession(restoredSession)}>Continue exam</button>
          <button type="button" onClick={() => { if (window.confirm('Start a new exam? Your unfinished exam and its answers will be discarded.')) start() }}>Start a new exam</button>
        </div>
      </div>
    </section>
  }

  return <section><div className="page-heading"><div><p className="eyebrow">Cloud Practitioner question bank</p><h1>Practice exams</h1></div></div>
    <div className="section-card exam-setup"><h2>Generated question-bank exam</h2><p>This creates a randomized, balanced {generatedExamQuestionCount}-question exam from all {questions.length} Cloud Practitioner questions. Every subject area is included when available.</p>
      <p><strong>90 minutes</strong> · Correct answers and explanations appear only after submission.</p>
      <button type="button" className="primary" onClick={start}>Start 90-minute exam</button></div>
  </section>
}

function ExamResults({ attempt, questions, onBack }: { attempt: ExamAttempt; questions: Question[]; onBack: () => void }) {
  const [subjectArea, setSubjectArea] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const subjectAreas = [...new Set(questions.map((question) => question.subjectArea))].sort()
  const reviewedQuestions = questions.filter((question) => (subjectArea === 'all' || question.subjectArea === subjectArea) && (!flaggedOnly || attempt.flaggedQuestionIds?.includes(question.id)))
  const insights = calculateSubjectAreaInsights(questions, [attempt]).filter((insight) => insight.answered)
  return <section><div className="hero-panel results"><p className="eyebrow">Results</p><h1>{attempt.score}/{attempt.total} correct</h1><p>{Math.round((attempt.score / attempt.total) * 100)}% · {attempt.flaggedQuestionIds?.length ?? 0} questions flagged during the exam.</p><button type="button" onClick={onBack}>Back to practice exams</button></div>
    <section className="section-card"><h2>Subject-area performance</h2><div className="insight-grid">{insights.map((insight) => <div key={insight.subjectArea}><strong>{Math.round((insight.accuracy ?? 0) * 100)}%</strong><span>{insight.subjectArea} · {insight.answered} questions</span></div>)}</div></section>
    <div className="filters review-filters"><label>Review subject area<select value={subjectArea} onChange={(event) => setSubjectArea(event.target.value)}><option value="all">All subject areas</option>{subjectAreas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label><label className="check"><input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} /> Flagged questions only</label></div>
    <p className="helper">Showing {reviewedQuestions.length} questions.</p>
    {reviewedQuestions.map((question) => { const index = questions.indexOf(question); const correct = answersAreCorrect(attempt.answers[question.id], question.correctOptionIds); return <article className={`question-card ${correct ? 'correct' : 'incorrect'}`} key={question.id}><p className="eyebrow">{correct ? 'Correct' : 'Incorrect'} · {question.subjectArea} · Question {index + 1}{attempt.flaggedQuestionIds?.includes(question.id) ? ' · Flagged' : ''}</p><h2>{question.prompt}</h2><p>Your answer: {(attempt.answers[question.id] ?? []).join(', ') || 'No answer'}</p><p>Correct answer: <strong>{question.correctOptionIds.join(', ')}</strong></p>{question.explanation && <p className="explanation">{question.explanation}</p>}</article> })}
  </section>
}

function Settings({ data, storagePersistent, onSave, onNotice }: { data: AppData; storagePersistent: boolean | null; onSave: (data: AppData) => Promise<void>; onNotice: (message: string) => void }) {
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')
  const [certificationName, setCertificationName] = useState('')
  const [certificationCode, setCertificationCode] = useState('')
  const [certificationLevel, setCertificationLevel] = useState('')
  function addCategory(event: React.FormEvent) {
    event.preventDefault()
    if (!categoryName.trim()) return
    const category: Category = { id: createId('category'), name: categoryName.trim(), description: categoryDescription.trim(), color: '#2563eb', certificationIds: [data.activeCertificationId] }
    void onSave({ ...data, categories: [...data.categories, category] })
    setCategoryName(''); setCategoryDescription('')
  }
  function addCertification(event: React.FormEvent) {
    event.preventDefault()
    if (!certificationName.trim() || !certificationCode.trim() || !certificationLevel.trim()) return
    const certification: Certification = {
      id: createId('certification'),
      name: certificationName.trim(),
      code: certificationCode.trim(),
      level: certificationLevel.trim(),
      description: '',
      active: true,
    }
    void onSave({ ...data, certifications: [...data.certifications, certification] })
    setCertificationName(''); setCertificationCode(''); setCertificationLevel('')
  }
  async function importBackup(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validateBackup(parsed)) throw new Error('This file is not a compatible AWS Revision Hub backup.')
      await onSave(parsed)
      onNotice('Backup restored successfully.')
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Unable to read backup file.') }
  }
  return <section><div className="page-heading"><div><p className="eyebrow">Local data controls</p><h1>Settings</h1></div></div>
    <div className="settings-grid"><article className="section-card"><h2>Theme</h2><p className="helper">Choose a colour scheme. Your choice is saved with your study data.</p><div className="theme-options" role="radiogroup" aria-label="Colour theme">{themes.map((option) => { const selected = (data.theme ?? 'blue') === option.id; return <button type="button" role="radio" aria-checked={selected} className={selected ? 'theme-option selected' : 'theme-option'} key={option.id} onClick={() => void onSave({ ...data, theme: option.id })}><span className="theme-swatch" style={{ background: option.swatch }} />{option.name}</button> })}</div></article>
      <article className="section-card"><h2>Certifications</h2><p className="helper">Add future AWS certifications now. Their practice exams can be imported as separately identified banks later.</p><form onSubmit={addCertification}><label>Name<input value={certificationName} onChange={(event) => setCertificationName(event.target.value)} required /></label><label>Exam code<input value={certificationCode} onChange={(event) => setCertificationCode(event.target.value)} required placeholder="e.g. SAA-C03" /></label><label>Level<input value={certificationLevel} onChange={(event) => setCertificationLevel(event.target.value)} required placeholder="e.g. Associate" /></label><button className="primary" type="submit">Add certification</button></form>{data.certifications.map((certification) => <div className="list-row" key={certification.id}><span>{certification.name} <small>({certification.code})</small></span>{certification.id !== data.activeCertificationId && <button type="button" onClick={() => void onSave({ ...data, certifications: data.certifications.map((item) => item.id === certification.id ? { ...item, active: !item.active } : item) })}>{certification.active ? 'Archive' : 'Activate'}</button>}</div>)}</article>
      <article className="section-card"><h2>Categories</h2><p className="helper">Categories organize terminology today and are ready for future question-bank tagging.</p><form onSubmit={addCategory}><label>Name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required /></label><label>Description<input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} /></label><button className="primary" type="submit">Add category</button></form>{data.categories.map((category) => <div className="list-row" key={category.id}><span>{category.name}</span><button type="button" className="danger" onClick={() => { const used = data.terms.some((term) => term.categoryIds.includes(category.id)); if (used) { onNotice('This category is still used by terminology. Remove it from those entries before deleting.'); return } void onSave({ ...data, categories: data.categories.filter((item) => item.id !== category.id) }) }}>Delete</button></div>)}</article>
      <article className="section-card"><h2>Backup and restore</h2><p>All learning data is saved automatically in this browser and stays after you close the tab. Export a backup before clearing browser data or changing devices.</p><p className="helper">Persistent storage: <strong>{storagePersistent === null ? 'Not supported by this browser' : storagePersistent ? 'Granted (browser will not auto-delete your data)' : 'Not granted (browser may clear data if disk space runs low)'}</strong>. Always open the app at the same address (e.g. http://localhost:5173) and avoid private/incognito windows.</p><div className="actions"><button type="button" onClick={() => download('aws-revision-hub-backup.json', JSON.stringify(data, null, 2), 'application/json')}>Export backup</button><label className="file-button">Restore backup<input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file) }} /></label></div></article></div>
  </section>
}

export default App
