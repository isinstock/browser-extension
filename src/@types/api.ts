import {Product} from './linked-data'
import {Retailer} from './retailers'

type RequireAtLeastOne<T> = {[K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>}[keyof T]

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

interface NearbyInventoryResponseSku {
  sku: string
  model: string
  upc: string
  salePrice?: number
  price: number
  currency: string
}

interface NearbyInventoryResponseRetailer {
  name: string
  url: string
}

interface NearbyInventoryResponseLocationCoordinate {
  latitude: number
  longitude: number
}

interface NearbyInventoryResponseInventoryCheck {
  state: string
  quantity?: number
  checkedAt?: Date
  createdAt: Date
}

interface NearbyInventoryResponseSkuLocationLocation {
  name: string
  url: string
  meters?: number
  coordinate?: NearbyInventoryResponseLocationCoordinate
  inventoryCheck?: NearbyInventoryResponseInventoryCheck
}

interface NearbyInventoryResponseSkuLocation {
  sku: string
  model: string
  upc: string
  salePrice: number
  price: number
  currency: string
  url: string
  retailer: NearbyInventoryResponseRetailer
  locations: NearbyInventoryResponseSkuLocationLocation[]
}

interface NearbyInventoryResponseLocation {
  name: string
  url: string
  style: string
  coordinate?: NearbyInventoryResponseLocationCoordinate
}

export interface NearbyInventoryResponse {
  sku?: NearbyInventoryResponseSku
  location?: NearbyInventoryResponseLocation
  skus: NearbyInventoryResponseSkuLocation[]
}
