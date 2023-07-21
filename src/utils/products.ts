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
  const response = await fetchApi(
    '/api/products/validate',
    'POST',
    JSON.stringify({
      url: window.location.href,
      product,
    }),
  )
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
    notFoundCallback()
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
    const json = loadJSON(script)
    if (json !== null) {
      const product = findProduct(json)
      if (product) {
        products.push(product)
      }
    }
  }

  return products
}

export const loadProduct = (script: HTMLElement): Product | null => {
  const json = loadJSON(script)
  if (json !== null) {
    return findProduct(json)
  }
  return null
}

type LocateProductsOptions = {
  runFired?: boolean
  productCallback: (product: Product) => void
  notFoundCallback?: () => void
}

// Allows callbacks for each product found and if none were found
export const searchProducts = ({runFired = false, productCallback, notFoundCallback}: LocateProductsOptions) => {
  const scripts: ObservableElement[] = Array.from(document.querySelectorAll(`script[type="application/ld+json"]`))
  const products = scripts.map(script => loadProduct(script)).filter(product => product !== null)

  // Valid pages will contain one Product structured data schema
  if (products.length === 1) {
    productCallback(products[0] as Product)
  } else if (notFoundCallback) {
    notFoundCallback()
  }
}
