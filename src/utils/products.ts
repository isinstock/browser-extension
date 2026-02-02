import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {Product} from '../@types/linked-data'
import fetchApi from './fetch-api'
import {hasProductType, PRODUCT_TYPES} from './helpers'
import {broadcastInventoryState} from './inventory-state'

const MICRODATA_SELECTORS = PRODUCT_TYPES.map(t => `[itemscope][itemtype$="/${t}" i]`).join(', ')

const RDFA_SELECTORS = PRODUCT_TYPES.flatMap(t => [
  `[typeof="${t}" i]`,
  `[typeof="schema:${t}" i]`,
]).join(', ')

// JSON+LD, Microdata, RDFa
export const SELECTOR = [
  'script[type="application/ld+json"]',
  MICRODATA_SELECTORS,
  RDFA_SELECTORS,
].join(', ')

const loadJSON = (script: HTMLElement): any | null => {
  if (script.textContent === null || script.textContent === '') {
    return null
  }

  try {
    return JSON.parse(script.textContent)
  } catch (error) {
    if (error instanceof SyntaxError && error.message.includes('control character')) {
      try {
        return JSON.parse(script.textContent.replace(/[\r\n]+/g, ''))
      } catch {
        // Retry also failed
      }
    }
    console.error(error)
    return null
  }
}

const findProductsInJSON = (json: any): Product[] => {
  // Top-level array: [{@type: Product}, {@type: BreadcrumbList}]
  if (Array.isArray(json)) {
    return json.filter(hasProductType)
  }

  // @graph wrapper: {@graph: [{@type: Product}, ...]}
  if (json?.['@graph'] && Array.isArray(json['@graph'])) {
    return json['@graph'].filter(hasProductType)
  }

  // Direct object: {@type: Product}
  if (hasProductType(json)) {
    return [json]
  }

  return []
}

type ProductCallbackProps = {
  url: string
  product?: Product
}

// Default callback when a product is found
export const productCallback = async ({url, product}: ProductCallbackProps): Promise<ProductValidationResponse> => {
  const body = JSON.stringify({
    url,
    product,
  })
  const response = await fetchApi('/api/products/validations', 'POST', body)
  let productValidationResponse: ProductValidationResponse = {
    result: ProductValidationResult.Unsupported,
  }
  if (response.ok) {
    productValidationResponse = await response.json()
  }

  return productValidationResponse
}

// Default callback when a product is not found
export const notFoundCallback = () => {
  broadcastInventoryState(InventoryStateNormalized.Unknown)
}

export const hasProducts = (): boolean => {
  const elements: HTMLElement[] = Array.from(document.querySelectorAll(SELECTOR))
  return elements.some(element => isProduct(element))
}

export const isProduct = (element: HTMLElement): boolean => {
  if (element.tagName === 'SCRIPT') {
    return loadProduct(element) !== null
  }

  const typeofAttribute = element.getAttribute('typeof')
  if (typeofAttribute !== null) {
    const value = typeofAttribute.trim()
    // Handle schema:Product, bare Product, and full URL forms
    const typeName = value
      .replace(/^schema:/i, '')
      .replace(/^https?:\/\/schema\.org\//i, '')
    if (PRODUCT_TYPES.some(t => t.toLowerCase() === typeName.toLowerCase())) {
      return true
    }
  }

  const itemtype = element.getAttribute('itemtype')
  if (itemtype !== null) {
    const typeName = itemtype.trim().replace(/^https?:\/\/schema\.org\//i, '')
    if (PRODUCT_TYPES.some(t => t.toLowerCase() === typeName.toLowerCase())) {
      return true
    }
  }

  return false
}

export const loadProduct = (script: HTMLElement): Product | null => {
  const json = loadJSON(script)
  const products = findProductsInJSON(json)
  return products.length > 0 ? (products[0] ?? null) : null
}

export const productsNotFound = async (): Promise<boolean> => {
  const button = document.querySelector('#isinstock-button')
  return Promise.resolve(button !== null)
}
