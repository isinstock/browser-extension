import {describe, expect, test} from 'vitest'

import {isInStock} from '../utils/inventory-state'

describe('isInStock', () => {
  test('returns true for bare InStock', () => {
    expect(isInStock('InStock')).toBe(true)
  })

  test('returns true for http:// prefixed InStock', () => {
    expect(isInStock('http://schema.org/InStock')).toBe(true)
  })

  test('returns true for https:// prefixed InStock', () => {
    expect(isInStock('https://schema.org/InStock')).toBe(true)
  })

  test('returns true for all in-stock availability values', () => {
    const values = ['InStock', 'InStoreOnly', 'LimitedAvailability', 'OnlineOnly', 'PreSale', 'PreOrder']
    for (const value of values) {
      expect(isInStock(value)).toBe(true)
      expect(isInStock(`http://schema.org/${value}`)).toBe(true)
      expect(isInStock(`https://schema.org/${value}`)).toBe(true)
    }
  })

  test('returns false for OutOfStock', () => {
    expect(isInStock('OutOfStock')).toBe(false)
    expect(isInStock('https://schema.org/OutOfStock')).toBe(false)
  })

  test('returns false for Discontinued', () => {
    expect(isInStock('Discontinued')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isInStock('')).toBe(false)
  })

  test('is case insensitive (accent sensitivity)', () => {
    expect(isInStock('instock')).toBe(true)
    expect(isInStock('INSTOCK')).toBe(true)
  })
})
