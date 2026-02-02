import {AggregateOffer, Offer, Product} from '../@types/linked-data'

export const isAggregateOffer = (obj?: Offer | Offer[] | AggregateOffer): obj is AggregateOffer => {
  if (!obj || obj instanceof Array) {
    return false
  }

  return obj['@type'] === 'AggregateOffer'
}

export const isMultipleOffers = (obj?: Offer | Offer[] | AggregateOffer): obj is Offer[] => {
  return obj instanceof Array
}

export const isOffer = (obj?: Offer | Offer[] | AggregateOffer): obj is Offer => {
  if (!obj || obj instanceof Array) {
    return false
  }

  return obj['@type'] === 'Offer'
}

export const findOffer = (obj: Product | AggregateOffer): Offer | null => {
  if (!obj.offers) {
    return null
  }

  if (isOffer(obj.offers)) {
    return obj.offers
  }

  if (isAggregateOffer(obj.offers)) {
    return findOffer(obj.offers)
  }

  if (isMultipleOffers(obj.offers)) {
    if (obj.offers.length > 1) {
      const newOffers = obj.offers.filter(offer => isNewCondition(offer))
      return newOffers.length === 1 ? (newOffers[0] ?? null) : null
    } else if (obj.offers.length === 1) {
      return obj.offers[0] ?? null
    }
  }

  return null
}

export const isNewCondition = (offer: Offer): boolean => {
  if (offer.itemCondition === null) {
    return false
  }

  return (
    offer.itemCondition === 'http://schema.org/NewCondition' ||
    offer.itemCondition === 'https://schema.org/NewCondition' ||
    offer.itemCondition === 'NewCondition'
  )
}

export const isProductSchema = (obj?: any): obj is Product => {
  if (obj === undefined || obj === null || obj instanceof Array) {
    return false
  }

  return obj['@type'] === 'Product'
}
