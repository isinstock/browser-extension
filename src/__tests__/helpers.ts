import {Offer, Product} from '../@types/linked-data'
import {findOffer} from '../utils/helpers'

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
