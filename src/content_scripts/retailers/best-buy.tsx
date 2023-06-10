import {NearbyInventoryProductRequest, NearbyInventorySearchProductStore} from '../../@types/api'
import {InventoryStateNormalized} from '../../@types/inventory-states'
import {MessageAction} from '../../@types/messages'
import {Retailer} from '../../@types/retailers'
import {insertIsInStockButton} from '../../elements/isinstock-button'
import {broadcastInventoryState, calculateInventoryState} from '../../utils/inventory-state'
import {findProducts} from '../../utils/products'

// Default callback when a product is found
export const productCallback = (href: string) => {
  const url = new URL(href)
  const sku = url.searchParams.get('skuId')

  if (sku) {
    const storeId = findStoreId()
    let store: NearbyInventorySearchProductStore | undefined
    if (storeId) {
      console.log('Likely found product with SKU', storeId)
      store = {
        identifier: storeId,
      }
    }

    const products = findProducts()
    const productSchema = products.find(product => product.sku === sku)
    let inventoryState: InventoryStateNormalized | undefined

    // Broadcast inventory state
    if (productSchema) {
      inventoryState = calculateInventoryState(productSchema)
      broadcastInventoryState(inventoryState)
    } else {
      broadcastInventoryState(InventoryStateNormalized.Unknown)
    }

    const nearbyInventoryRequest: NearbyInventoryProductRequest = {
      context: {
        url: href,
      },
      product: {
        retailer: Retailer.BestBuy,
        sku,
        store,
      },
      productSchema,
    }

    const addToCartButton = document.querySelector<HTMLElement>('.fulfillment-add-to-cart-button')
    if (addToCartButton) {
      const element = insertIsInStockButton(addToCartButton, {inventoryState, request: nearbyInventoryRequest})
      element.style.marginTop = '6px'
    } else {
      // Insert somewhere else?
    }
  }
}

const findStoreId = (): string | null => {
  const store = document.querySelector<HTMLAnchorElement>(`#store-loc-overlay a[href^="https://stores.bestbuy.com"]`)
  if (!store) {
    return null
  }

  const url = new URL(store.href)
  const matches = url.pathname.match(/^\/(?<storeId>\d+)$/)
  if (!matches || !matches.groups || !matches.groups.storeId) {
    return null
  }

  return matches.groups.storeId
}

const findSku = (): string | null => {
  const url = new URL(window.location.href)
  const sku = url.searchParams.get('skuId')
  if (sku) {
    return sku
  }

  // Backup SKU detection if skuId search parameter is not present.
  const matches = url.pathname.match(/^\/site\/.*\/(?<sku>\d+)\.p$/)
  if (!matches || !matches.groups || !matches.groups.sku) {
    return null
  }

  return matches.groups.sku
}

// Can we detect store location changing and re-issue request?
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === MessageAction.URLChanged) {
    console.log('URL changed to', request.url)
    productCallback(request.url)
  } else {
    console.log('Unknown action', request.action)
  }
})

// // Detect page transitions or DOM changes for single page based applications.
// const { observe, disconnect } = observeProducts(productCallback)

// const run = (runLoaded?: boolean) => {
//   observe()
// }

// // Run product location on page load
// run()

// // Once user leaves the page, disconnect the MutationObserver until user returns to tab.
// window.addEventListener('blur', disconnect)

// // Once user returns to the page, start the MutationObserver again and re-process page for updated chrome action icon.
// window.addEventListener('focus', () => {
//   run(true)
// })
