export type FlashcardRating = 'again' | 'good' | 'easy'

export interface Certification {
  id: string
  name: string
  code: string
  level: string
  description: string
  active: boolean
}

export interface Category {
  id: string
  name: string
  description: string
  color: string
  certificationIds: string[]
}

export interface Term {
  id: string
  term: string
  definition: string
  notes?: string
  source?: string
  certificationIds: string[]
  categoryIds: string[]
  createdAt: string
  updatedAt: string
}

export interface QuestionOption {
  id: string
  label: string
}

export interface Question {
  id: string
  certificationId: string
  sourceExamId: string
  sourceQuestionNumber: number
  prompt: string
  options: QuestionOption[]
  correctOptionIds: string[]
  explanation?: string
  categoryIds?: string[]
  subjectArea: string
}

export interface PracticeExam {
  id: string
  certificationId: string
  title: string
  sourceFile: string
  questionIds: string[]
}

export interface FlashcardProgress {
  termId: string
  again: number
  good: number
  easy: number
  lastReviewedAt: string
}

export interface FlashcardSession {
  id: string
  certificationId: string
  categoryId: string
  shuffle: boolean
  termIds: string[]
  fullTermIds: string[]
  index: number
  ratings: Record<string, FlashcardRating>
  skippedTermIds: string[]
  completed: boolean
}

export interface ExamAttempt {
  id: string
  certificationId: string
  examId?: string
  questionIds: string[]
  answers: Record<string, string[]>
  startedAt: string
  completedAt: string
  score: number
  total: number
  flaggedQuestionIds?: string[]
}

export interface AppData {
  version: 1
  activeCertificationId: string
  certifications: Certification[]
  categories: Category[]
  terms: Term[]
  flashcardProgress: FlashcardProgress[]
  flashcardSessions?: FlashcardSession[]
  examAttempts: ExamAttempt[]
  inProgressExam?: InProgressExam
  theme?: ThemeId
  starterCategoriesAdded?: boolean
}

export type ThemeId = 'blue' | 'pink' | 'purple' | 'green' | 'dark'

export const themes: { id: ThemeId; name: string; swatch: string }[] = [
  { id: 'blue', name: 'Ocean blue', swatch: '#2563eb' },
  { id: 'pink', name: 'Pink', swatch: '#db2777' },
  { id: 'purple', name: 'Purple', swatch: '#7c3aed' },
  { id: 'green', name: 'Green', swatch: '#059669' },
  { id: 'dark', name: 'Dark', swatch: 'linear-gradient(135deg, #0f172a 50%, #3b82f6 50%)' },
]

export interface InProgressExam {
  certificationId: string
  questionIds: string[]
  answers: Record<string, string[]>
  flaggedQuestionIds: string[]
  startedAt: string
}

export const cloudPractitionerCertification: Certification = {
  id: 'aws-certified-cloud-practitioner',
  name: 'AWS Certified Cloud Practitioner',
  code: 'CLF-C02',
  level: 'Foundational',
  description: 'Build foundational AWS Cloud knowledge and confidence.',
  active: true,
}
