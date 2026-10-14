import { describe, expect, it } from 'vitest'
import { createDefaultAppData, withStarterCategories } from './database'

describe('starter categories', () => {
  it('adds starter categories once to older saved data without duplicating existing names', () => {
    const older = { ...createDefaultAppData(), starterCategoriesAdded: undefined, categories: [{ id: 'custom', name: 'compute', description: '', color: '#000', certificationIds: ['x'] }] }
    const seeded = withStarterCategories(older)
    expect(seeded.starterCategoriesAdded).toBe(true)
    expect(seeded.categories).toHaveLength(9)
    expect(seeded.categories.filter((category) => category.name.toLowerCase() === 'compute')).toHaveLength(1)

    const afterDeletingAll = withStarterCategories({ ...seeded, categories: [] })
    expect(afterDeletingAll.categories).toHaveLength(0)
  })
})
