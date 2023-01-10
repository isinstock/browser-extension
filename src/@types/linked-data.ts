// http://developers.google.com/search/docs/appearance/structured-data/product#json-ld

export interface LinkedDataType {
  '@context': 'http://schema.org/' | 'http://schema.org'
  '@type': string
}

export interface Brand {
  '@type': 'Brand'
  name: string
}

export interface AggregateRating {
  '@type': 'AggregateRating'
  name: string
  ratingValue?: number
  reviewCount?: number
}

export interface Product extends LinkedDataType {
  '@type': 'Product'
  brand?: Brand

  // An Amazon Standard Identification Number (ASIN) is a 10-character alphanumeric unique identifier assigned by
  // Amazon.com and its partners for product identification within the Amazon organization (summary from Wikipedia's
  // article).
  //
  // Note also that this is a definition for how to include ASINs in Schema.org data, and not a definition of ASINs in
  // general - see documentation from Amazon for authoritative details. ASINs are most commonly encoded as text strings,
  // but the [asin] property supports URL/URI as potential values too.
  asin?: string
  gtin13?: string
  color?: string
  model?: string
  name?: string
  sku?: string
  url?: string
  description?: string
  aggregateRating?: AggregateRating
  depth?: QuantitativeValue
  width?: QuantitativeValue
  height?: QuantitativeValue
  offers?: Offer | Offer[] | AggregateOffer
}

export type LinkedDataTypes = Product

export type QuantitativeValue = {
  '@type': string
  unitCode: string
  value: string
}

// A list of possible product availability options.
// The short names without the URL prefix are also supported (for example, BackOrder).
export declare type ItemAvailability =
  // The item is on back order.
  | 'http://schema.org/BackOrder'
  | 'https://schema.org/BackOrder'
  | 'BackOrder'

  // The item has been discontinued.
  | 'http://schema.org/Discontinued'
  | 'https://schema.org/Discontinued'
  | 'Discontinued'

  // The item is in stock.
  | 'http://schema.org/InStock'
  | 'https://schema.org/InStock'
  | 'InStock'

  // The item is only available for purchase in store.
  | 'http://schema.org/InStoreOnly'
  | 'https://schema.org/InStoreOnly'
  | 'InStoreOnly'

  // The item has limited availability.
  | 'http://schema.org/LimitedAvailability'
  | 'https://schema.org/LimitedAvailability'
  | 'LimitedAvailability'

  // The item is available online only.
  | 'http://schema.org/OnlineOnly'
  | 'https://schema.org/OnlineOnly'
  | 'OnlineOnly'

  // The item is currently out of stock.
  | 'http://schema.org/OutOfStock'
  | 'https://schema.org/OutOfStock'
  | 'OutOfStock'

  // The item is available for pre-order.
  | 'http://schema.org/PreOrder'
  | 'https://schema.org/PreOrder'
  | 'PreOrder'

  // The item is available for ordering and delivery before general availability.
  | 'http://schema.org/PreSale'
  | 'https://schema.org/PreSale'
  | 'PreSale'

  // The item has been sold out.
  | 'http://schema.org/SoldOut'
  | 'https://schema.org/SoldOut'
  | 'SoldOut'

type ItemAvailabilityBackOrder = 'http://schema.org/BackOrder' | 'https://schema.org/BackOrder' | 'BackOrder'

export const isBackorder = (state: string): state is ItemAvailabilityBackOrder => {
  return state == 'http://schema.org/BackOrder' || state == 'https://schema.org/BackOrder' || state == 'BackOrder'
}

// A predefined value from OfferItemCondition specifying the condition of the
// product or service, or the products or services included in the offer. Also
// used for product return policies to specify the condition of products
// accepted for returns.
export declare type OfferItemCondition =
  // Indicates that the item is new.
  | 'http://schema.org/NewCondition'
  | 'https://schema.org/NewCondition'
  | 'NewCondition'

  // Indicates that the item is used.
  | 'http://schema.org/UsedCondition'
  | 'https://schema.org/UsedCondition'
  | 'UsedCondition'

  // Indicates that the item is damaged.
  | 'http://schema.org/DamagedCondition'
  | 'https://schema.org/DamagedCondition'
  | 'DamagedCondition'

  // Indicates that the item is refurbished.
  | 'http://schema.org/RefurbishedCondition'
  | 'https://schema.org/RefurbishedCondition'
  | 'RefurbishedCondition'

// An offer to transfer some rights to an item or to provide a service — for
// example, an offer to sell tickets to an event, to rent the DVD of a movie,
// to stream a TV show over the internet, to repair a motorcycle, or to loan a
// book.
export type Offer = {
  '@type': 'Offer'
  description?: string
  availability?: ItemAvailability
  itemCondition?: OfferItemCondition
  sku?: string
  price?: string | number
  priceCurrency?: string
  url?: string
}

// When a single product is associated with multiple offers (for example, the
// same pair of shoes is offered by different merchants), then AggregateOffer can be used.
export type AggregateOffer = {
  '@type': 'AggregateOffer'
  highPrice?: string
  lowPrice?: string
  offerCount?: number
  offers?: Offer[]
}
