import { ItemAvailability, OfferItemCondition, Product, Offer, AggregateOffer } from "../../@types/linked-data";
import { findOffer, isAggregateOffer, isInStock, isMultipleOffers, isNewCondition, isOffer } from "../../utils/helpers";
import { observeProducts } from "../../utils/observers"
import { calculateInventoryState } from "../../utils/inventory-state";
import { findProducts, notFoundCallback, productCallback } from "../../utils/products";
import { insertWidget } from "../../elements/widget";
import { MessageAction } from "../../@types/messages";
import { InventoryState } from "../../@types/inventory-states";
import { findNearbyInventory } from "../../utils/nearby-inventory";
import { NearbyInventoryProductRequest, NearbyInventorySearchProductStore } from "../../@types/api";
import { Retailer } from "../../@types/retailers";

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == MessageAction.URLChanged) {
    console.log("URL changed to", request.url)

    const url = new URL(request.url)
    const sku = url.searchParams.get("skuId")

    if (sku) {
      console.log("Likely found product with SKU", sku)
      const storeId = findStoreId()
      let store: NearbyInventorySearchProductStore | undefined = undefined
      if (storeId) {
        console.log("Likely found product with SKU", storeId)
        store = {
          identifier: storeId,
        }
      }

      const products = findProducts()
      const productSchema = products.find(product => product.sku == sku)

      const nearbyInventoryRequest: NearbyInventoryProductRequest = {
        context: {
          url: request.url,
          userAgent: navigator.userAgent,
        },
        product: {
          retailer: Retailer.BestBuy,
          sku,
          store,
        },
        productSchema,
      }

      findNearbyInventory(nearbyInventoryRequest)
    } else {
      chrome.runtime.sendMessage({
        action: MessageAction.InventoryState,
        value: InventoryState.Unknown,
      })
    }
  } else {
    console.log("Unknown action", request.action)
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
