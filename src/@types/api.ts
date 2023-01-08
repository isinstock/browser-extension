import { Product } from "./linked-data"
import { Retailer } from "./retailers"

type RequireAtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>; }[keyof T]

export interface NearbyInventorySearch {
  manufacture?: string
  name?: string
  sku?: string
  model?: string
  url?: string
  description?: string
  upc?: string
  price?: number
  currency?: string
}

export interface NearbyInventoryContext {
  url: string
  userAgent: string
}

export interface NearbyInventoryRequest {
  context: NearbyInventoryContext
  productSchema?: Product
}

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface NearbyInventorySearchProductStore {
  identifier?: string
  coordinate?: Coordinate
}

export interface NearbyInventorySearchProduct {
  retailer: Retailer
  sku: string
  store?: NearbyInventorySearchProductStore
}

export interface NearbyInventorySearchRequest extends NearbyInventoryRequest {
  search: NearbyInventorySearch
}

export interface NearbyInventoryProductRequest extends NearbyInventoryRequest {
  product: NearbyInventorySearchProduct
}

export type NearbyInventoryRequestType = NearbyInventorySearchRequest | NearbyInventoryProductRequest
