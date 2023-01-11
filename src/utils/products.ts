import {InventoryState} from '../@types/inventory-states'
import {Product} from '../@types/linked-data'
import {ObservableElement} from '../@types/observables'
import {MessageAction} from '../@types/messages'
import {insertWidget} from '../elements/widget'
import {isProduct} from './helpers'
import {broadcastInventoryState, calculateInventoryState} from './inventory-state'
import {findNearbyInventory, requestFromProduct} from './nearby-inventory'

const loadJSON = (script: Element): any[] => {
  if (!script.textContent || script.textContent == '') {
    return []
  }

  try {
    return JSON.parse(script.textContent)
  } catch (e) {
    return []
  }
}

const findProduct = (obj?: any): Product | null => {
  if (!obj || !isProduct(obj)) {
    return null
  }

  return obj
}

// Default callback when a product is found
export const productCallback = (product: Product) => {
  const inventoryState = calculateInventoryState(product)
  const request = requestFromProduct(product)

  broadcastInventoryState(inventoryState)
  findNearbyInventory(request, inventoryState)
}

// Default callback when a product is not found
export const notFoundCallback = () => {
  chrome.runtime.sendMessage({
    action: MessageAction.InventoryState,
    value: InventoryState.Unknown,
  })
}

export const findProducts = (): Product[] => {
  const scripts: NodeListOf<Element> = document.querySelectorAll(`script[type="application/ld+json"]`)
  const products: Product[] = []
  scripts.forEach(script => {
    const json = loadJSON(script)
    if (json) {
      const product = findProduct(json)
      if (product) {
        products.push(product)
      }
    }
  })

  return products
}

export const loadProduct = (script: Element): Product | null => {
  const json = loadJSON(script)
  if (json) {
    return findProduct(json)
  } else {
    return null
  }
}

type LocateProductsOptions = {
  runFired?: boolean
  productCallback: (product: Product) => void
  notFoundCallback?: () => void
}

// Allows callbacks for each product found and if none were found
export const searchProducts = ({runFired = false, productCallback, notFoundCallback}: LocateProductsOptions) => {
  const scripts: NodeListOf<ObservableElement> = document.querySelectorAll(`script[type="application/ld+json"]`)
  if (scripts.length) {
    scripts.forEach(script => {
      if (runFired || !script.fired) {
        script.fired = true

        const product = loadProduct(script)
        if (product) {
          productCallback(product)
        }
      } else {
        console.warn('Already loaded script for', script)
      }
    })
  } else if (notFoundCallback) {
    notFoundCallback()
  }
}
