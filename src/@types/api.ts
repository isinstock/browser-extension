import {InventoryStateNormalized} from './inventory-states'
import {Product} from './linked-data'
import {Coordinate, LocationStyle, LocationStyleNormalized} from './locations'
import {Retailer} from './retailers'

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

export interface NearbyInventorySearchProductStore {
  identifier?: string
  name?: string
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

export interface NearbyInventoryResponseSku {
  sku: string
  model?: string
  upc?: string
  currency: string
  price: number
  formattedPrice: string
  salePrice?: number
  formattedSalePrice?: string
  discount?: number
  discountedPercentage?: number
  formattedDiscountPrice?: string
  productUrl: string
  url: string
  retailer: NearbyInventoryResponseRetailer
  locations: NearbyInventoryResponseSkuLocation[]
}

export interface NearbyInventoryResponseRetailer {
  name: string
  retailerUrl: string
  imageUrl: string
}

export interface NearbyInventoryResponseInventoryCheck {
  state: InventoryStateNormalized
  quantity?: number
  checkedAt?: Date
  createdAt: Date
}

export interface NearbyInventoryResponseSkuLocationBase {
  name: string
  locationUrl: string
  inventoryCheck?: NearbyInventoryResponseInventoryCheck
  style: LocationStyle
  normalizedStyle: LocationStyleNormalized
}

export interface NearbyInventoryResponseSkuLocationPhysical extends NearbyInventoryResponseSkuLocationBase {
  address: string
  meters: number
  coordinate: Coordinate
}

export type NearbyInventoryResponseSkuLocationOnline = NearbyInventoryResponseSkuLocationBase

export type NearbyInventoryResponseSkuLocation =
  | NearbyInventoryResponseSkuLocationPhysical
  | NearbyInventoryResponseSkuLocationOnline

export const isOnlineSkuLocation = (
  skuLocation: NearbyInventoryResponseSkuLocation,
): skuLocation is NearbyInventoryResponseSkuLocationOnline => {
  return skuLocation.normalizedStyle === LocationStyleNormalized.Online
}

export const isPhysicalSkuLocation = (
  skuLocation: NearbyInventoryResponseSkuLocation,
): skuLocation is NearbyInventoryResponseSkuLocationPhysical => {
  return skuLocation.normalizedStyle === LocationStyleNormalized.Physical
}

// Can this be one of the other types?
export interface NearbyInventoryResponseLocation {
  name: string
  locationUrl: string
  coordinate?: Coordinate
  style: LocationStyle
  normalizedStyle: LocationStyleNormalized
}

export enum NearbyInventoryResponseState {
  Found = 'found',
  Importable = 'importable',
  Unsupported = 'unsupported',
}

export interface NearbyInventoryResponse {
  state: NearbyInventoryResponseState
  sku?: NearbyInventoryResponseSku
  location?: NearbyInventoryResponseLocation
  skus: NearbyInventoryResponseSku[]
}

export interface NearbyInventoryResponseFound extends NearbyInventoryResponse {
  state: NearbyInventoryResponseState.Found
  sku: NearbyInventoryResponseSku
}

export interface NearbyInventoryResponseImportable extends NearbyInventoryResponse {
  state: NearbyInventoryResponseState.Importable
  sku: undefined
}

export interface NearbyInventoryResponseUnsupported extends NearbyInventoryResponse {
  state: NearbyInventoryResponseState.Unsupported
}

export const isFoundNearbyInventoryResponse = (data: NearbyInventoryResponse): data is NearbyInventoryResponseFound => {
  return data.state === NearbyInventoryResponseState.Found
}

export const isImportableNearbyInventoryResponse = (
  data: NearbyInventoryResponse,
): data is NearbyInventoryResponseImportable => {
  return data.state === NearbyInventoryResponseState.Importable
}

export const isUnsupportedNearbyInventoryResponse = (
  data: NearbyInventoryResponse,
): data is NearbyInventoryResponseUnsupported => {
  return data.state === NearbyInventoryResponseState.Unsupported
}
