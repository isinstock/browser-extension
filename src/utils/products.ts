import {ProductValidationResponse} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {Product} from '../@types/linked-data'
import {ObservableElement} from '../@types/observables'
import fetchApi from './fetch-api'
import {isProduct} from './helpers'
import {broadcastInventoryState} from './inventory-state'

const loadJSON = (script: HTMLElement): any | null => {
  if (script.textContent === null || script.textContent === '') {
    return
  }

  try {
    return JSON.parse(script.textContent)
  } catch (e) {
    return
  }
}

const findProduct = (obj?: any): Product | null => {
  if (obj === null || !isProduct(obj)) {
    return null
  }

  return obj
}

// Default callback when a product is found
export const productCallback = async (product: Product) => {
  const body = JSON.stringify({
    url: window.location.href,
    product,
  })
  const response = await fetchApi('/api/products/validate', 'POST', body)
  if (response.ok) {
    const json = (await response.json()) as ProductValidationResponse
    switch (json.result) {
      case 'supported':
        broadcastInventoryState(InventoryStateNormalized.Available)
        break

      case 'unsupported':
        broadcastInventoryState(InventoryStateNormalized.Unavailable)
        break

      default:
        broadcastInventoryState(InventoryStateNormalized.Unknown)
        break
    }
  } else {
    broadcastInventoryState(InventoryStateNormalized.Unknown)
  }
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

export const loadProduct = (script: HTMLElement): Product | null => {
  const json = loadJSON(script)
  return findProduct(json)
}

type LocateProductsOptions = {
  runFired?: boolean
  productCallback: (product: Product) => void
  notFoundCallback?: () => void
}

// Allows callbacks for each product found and if none were found
export const searchProducts = ({runFired = false, productCallback, notFoundCallback}: LocateProductsOptions) => {
  const scripts: ObservableElement[] = Array.from(document.querySelectorAll(`script[type="application/ld+json"]`))
  const products = scripts
    .filter(script => !script.fired || runFired)
    .map(script => loadProduct(script))
    .filter(product => product !== null)

  // Valid pages will contain one Product structured data schema
  if (products.length === 1) {
    const product = products[0]
    if (product !== null) {
      productCallback(product)
    }
  } else if (notFoundCallback) {
    notFoundCallback()
  }
}
