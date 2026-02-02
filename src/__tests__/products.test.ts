import {describe, expect, test} from 'vitest'

import {isProductSchema} from '../utils/helpers'

describe('isProductSchema', () => {
  test('returns true for Product', () => {
    expect(isProductSchema({'@type': 'Product'})).toBe(true)
  })

  test('returns false for array', () => {
    expect(isProductSchema([{'@type': 'Product'}])).toBe(false)
  })

  test('returns false for null', () => {
    expect(isProductSchema(null)).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isProductSchema(undefined)).toBe(false)
  })

  test('returns false for other @type', () => {
    expect(isProductSchema({'@type': 'WebSite'})).toBe(false)
  })
})
