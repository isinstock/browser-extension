import {describe, expect, test} from 'vitest'

import {Offer, Product} from '../@types/linked-data'
import {findOffer, isAggregateOffer, isMultipleOffers, isNewCondition, isOffer, isProductSchema} from '../utils/helpers'

describe('findOffer', () => {
  test('returns null if no offers', () => {
    const product: Product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
    }

    expect(findOffer(product)).toBeNull()
  })

  test('returns offer if offers is an object', () => {
    const offer: Offer = {
      '@type': 'Offer',
    }
    const product: Product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      offers: offer,
    }

    expect(findOffer(product)).toEqual(offer)
  })

  test('returns new offer if multiple offers', () => {
    const newOffer: Offer = {
      '@type': 'Offer',
      itemCondition: 'NewCondition',
    }

    const usedOffer: Offer = {
      '@type': 'Offer',
      itemCondition: 'UsedCondition',
    }
    const product: Product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      offers: [newOffer, usedOffer],
    }

    expect(findOffer(product)).toEqual(newOffer)
  })

  test('returns null if multiple new offers', () => {
    const newOffer: Offer = {
      '@type': 'Offer',
      itemCondition: 'NewCondition',
    }
    const product: Product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      offers: [newOffer, newOffer],
    }

    expect(findOffer(product)).toBeNull()
  })
})

describe('isAggregateOffer', () => {
  test('returns true for AggregateOffer', () => {
    expect(isAggregateOffer({'@type': 'AggregateOffer'})).toBe(true)
  })

  test('returns false for Offer', () => {
    expect(isAggregateOffer({'@type': 'Offer'})).toBe(false)
  })

  test('returns false for array', () => {
    expect(isAggregateOffer([{'@type': 'Offer'}])).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isAggregateOffer(undefined)).toBe(false)
  })
})

describe('isMultipleOffers', () => {
  test('returns true for array', () => {
    expect(isMultipleOffers([{'@type': 'Offer'}])).toBe(true)
  })

  test('returns false for single offer', () => {
    expect(isMultipleOffers({'@type': 'Offer'})).toBe(false)
  })
})

describe('isOffer', () => {
  test('returns true for Offer', () => {
    expect(isOffer({'@type': 'Offer'})).toBe(true)
  })

  test('returns false for AggregateOffer', () => {
    expect(isOffer({'@type': 'AggregateOffer'})).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isOffer(undefined)).toBe(false)
  })

  test('returns false for array', () => {
    expect(isOffer([{'@type': 'Offer'}])).toBe(false)
  })
})

describe('isNewCondition', () => {
  test('returns true for bare NewCondition', () => {
    expect(isNewCondition({'@type': 'Offer', itemCondition: 'NewCondition'})).toBe(true)
  })

  test('returns true for http:// NewCondition', () => {
    expect(isNewCondition({'@type': 'Offer', itemCondition: 'http://schema.org/NewCondition'})).toBe(true)
  })

  test('returns true for https:// NewCondition', () => {
    expect(isNewCondition({'@type': 'Offer', itemCondition: 'https://schema.org/NewCondition'})).toBe(true)
  })

  test('returns false for UsedCondition', () => {
    expect(isNewCondition({'@type': 'Offer', itemCondition: 'UsedCondition'})).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isNewCondition({'@type': 'Offer'})).toBe(false)
  })
})

describe('isProductSchema', () => {
  test('returns true for Product type', () => {
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
    expect(isProductSchema({'@type': 'Organization'})).toBe(false)
  })
})
