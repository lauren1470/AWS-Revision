import { cloudPractitionerCertification } from './types'
import type { AppData, Category } from './types'
import { isFlashcardSession } from './flashcards'

const databaseName = 'aws-certification-revision-hub'
const storeName = 'state'
const stateKey = 'app-data'

const starterCategoryNames = [
  'Cloud concepts and migration',
  'Identity and access management (IAM)',
  'Security and compliance',
  'Compute',
  'Storage',
  'Networking and content delivery',
  'Databases and analytics',
  'Management and monitoring',
  'Pricing, billing, and support',
]

export function createStarterCategories(certificationId: string): Category[] {
  return starterCategoryNames.map((name) => ({
    id: `category-${certificationId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name,
    description: '',
    color: '#2563eb',
    certificationIds: [certificationId],
  }))
}

export function createDefaultAppData(): AppData {
  return {
    version: 1,
    activeCertificationId: cloudPractitionerCertification.id,
    certifications: [cloudPractitionerCertification],
    categories: createStarterCategories(cloudPractitionerCertification.id),
    starterCategoriesAdded: true,
    terms: [],
    flashcardProgress: [],
    examAttempts: [],
  }
}

// Seeds starter categories once for data saved before they existed; deleted starters are not re-added.
export function withStarterCategories(data: AppData): AppData {
  if (data.starterCategoriesAdded) return data
  const existingNames = new Set(data.categories.map((category) => category.name.toLowerCase()))
  const missing = createStarterCategories(cloudPractitionerCertification.id).filter((category) => !existingNames.has(category.name.toLowerCase()))
  return { ...data, categories: [...data.categories, ...missing], starterCategoriesAdded: true }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Unable to open local study storage.'))
  })
}

export async function loadAppData(): Promise<AppData> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(stateKey)
    request.onsuccess = () => {
      const stored = request.result as AppData | undefined
      resolve(stored ? withStarterCategories(stored) : createDefaultAppData())
    }
    request.onerror = () => reject(new Error('Unable to load local study data.'))
  })
}

export async function saveAppData(data: AppData): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(data, stateKey)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error('Unable to save local study data.'))
  })
}

// Without this, browsers may evict IndexedDB data under storage pressure.
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false
  }
  return (await navigator.storage.persisted()) || navigator.storage.persist()
}

export function validateBackup(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') {
    return false
  }
  const data = value as Partial<AppData>
  return (
    data.version === 1 &&
    Array.isArray(data.certifications) &&
    Array.isArray(data.categories) &&
    Array.isArray(data.terms) &&
    Array.isArray(data.flashcardProgress) &&
    Array.isArray(data.examAttempts) &&
    (data.flashcardSessions === undefined || (Array.isArray(data.flashcardSessions) && data.flashcardSessions.every(isFlashcardSession))) &&
    typeof data.activeCertificationId === 'string'
  )
}
