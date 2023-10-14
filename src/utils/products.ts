import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {Product} from '../@types/linked-data'
import {ObservableElement} from '../@types/observables'
import fetchApi from './fetch-api'
import {isProductSchema} from './helpers'
import {broadcastInventoryState} from './inventory-state'

export const SELECTOR = `script[type="application/ld+json"], [itemscope][itemtype*="Product" i], [typeof="schema:Product" i]`

const loadJSON = (script: HTMLElement): any | null => {
  if (script.textContent === null || script.textContent === '') {
    return
  }

  try {
    return JSON.parse(script.textContent)
  } catch (error) {
    // TODO: Add regression tests for this, should we catch _again_?
    if (error instanceof SyntaxError && error.message.includes('control character')) {
      return JSON.parse(script.textContent.replace(/(\r\n|\n|\r)/gm, ''))
    }

    console.error(error)
    return
  }
}

const findProduct = (obj?: any): Product | null => {
  if (obj === null || !isProductSchema(obj)) {
    return null
  }

  return obj
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
    productValidationResponse = (await response.json()) as ProductValidationResponse
  }

  return productValidationResponse
}

// Default callback when a product is not found
export const notFoundCallback = () => {
  broadcastInventoryState(InventoryStateNormalized.Unknown)
}

export const findProducts = (): Product[] => {
  const scripts: NodeListOf<HTMLElement> = document.querySelectorAll(`script[type="application/ld+json"]`)
  const products: Product[] = []
  for (const script of scripts) {
    const product = loadProduct(script)
    if (product) {
      products.push(product)
    }
  }

  return products
}

export const hasProducts = (): boolean => {
  const elements: HTMLElement[] = Array.from(document.querySelectorAll(SELECTOR))
  return elements.some(element => isProduct(element))
}

export const isProduct = (element: HTMLElement): boolean => {
  if (element.tagName === 'SCRIPT') {
    return loadProduct(element) !== null
  }

  const itemtype = element.getAttribute('itemtype')
  if (itemtype === null) {
    return false
  }

  return itemtype.toLowerCase().includes('product')
}

export const loadProduct = (script: HTMLElement): Product | null => {
  const json = loadJSON(script)
  return findProduct(json)
}

type LocateProductsOptions = {
  runFired?: boolean
  productCallback: (props: ProductCallbackProps) => void
  notFoundCallback?: () => void
}

export const productsNotFound = async (): Promise<boolean> => {
  const button = document.querySelector('#isinstock-button')
  return Promise.resolve(button !== null)
}

// Allows callbacks for each product found and if none were found
export const searchProducts = ({
  runFired = false,
  productCallback: searchProductCallback,
  notFoundCallback: searchNotFoundCallback,
}: LocateProductsOptions) => {
  const scripts: ObservableElement[] = Array.from(document.querySelectorAll(`script[type="application/ld+json"]`))
  const products = scripts
    .filter(script => !script.fired || runFired)
    .map(script => loadProduct(script))
    .filter(product => product !== null)

  // Valid pages will contain one Product structured data schema
  if (products.length === 1) {
    const product = products[0]
    if (product !== null) {
      searchProductCallback({
        url: window.location.href,
        product,
      })
    }
  } else if (searchNotFoundCallback) {
    searchNotFoundCallback()
  }
}
