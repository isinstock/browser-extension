import { InventoryState } from "../@types/inventory-states"
import { Product } from "../@types/linked-data"
import { MessageAction } from "../@types/messages"
import { insertWidget } from "../elements/widget"
import { isProduct } from "./helpers"
import { calculateInventoryState } from "./inventory-state"
import { findNearbyInventory, requestFromProduct } from "./nearby-inventory"

interface ScriptElement extends Element {
  loaded: boolean
}

const loadJSON = (script: ScriptElement): any[] => {
  if (!script.textContent || script.textContent == "") {
    return []
  }

  try {
    return JSON.parse(script.textContent)
  } catch (e) {
    return []
  }
}

const findProduct = (obj?: any): Product | undefined => {
  if (!obj || !isProduct(obj)) {
    return
  }

  return obj
}

type LocateProductsOptions = {
  runLoaded?: boolean
  productCallback: (product: Product) => void
  notFoundCallback?: () => void
}

// Default callback when a product is found
export const productCallback = (product: Product) => {
  const inventoryState = calculateInventoryState(product)
  const request = requestFromProduct(product)

  chrome.runtime.sendMessage({
    action: MessageAction.InventoryState,
    value: inventoryState,
  })

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
  const scripts: NodeListOf<ScriptElement> = document.querySelectorAll(`script[type="application/ld+json"]`)
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

// Allows callbacks for each product found and if none were found
export const searchProducts = ({ runLoaded = false, productCallback, notFoundCallback }: LocateProductsOptions) => {
  const scripts: NodeListOf<ScriptElement> = document.querySelectorAll(`script[type="application/ld+json"]`)
  if (scripts.length) {
    scripts.forEach(script => {
      if (runLoaded || !script.loaded) {
        script.loaded = true
        const json = loadJSON(script)
        if (json) {
          const product = findProduct(json)
          if (product) {
            productCallback(product)
          }
        }
      } else {
        console.warn("Already loaded script for", script)
      }
    })
  } else if (notFoundCallback) {
    notFoundCallback()
  }
}
