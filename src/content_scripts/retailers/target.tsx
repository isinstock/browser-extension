import { findProducts } from "../../utils/products";
import { MessageAction } from "../../@types/messages";
import { InventoryState } from "../../@types/inventory-states";
import { findNearbyInventory } from "../../utils/nearby-inventory";
import { NearbyInventoryProductRequest, NearbyInventorySearchProductStore } from "../../@types/api";
import { Retailer } from "../../@types/retailers";
import { observeSelector, selectorAdded } from "../../utils/observers";
import { broadcastInventoryState, calculateInventoryState } from "../../utils/inventory-state";
import { insertIsInStockButton } from "../../elements/isinstock-button";
import { ObservableElement } from "../../@types/observables";

const storeIdSelectors = `
  #pageBodyContainer [data-test="@web/AddToCart/FulfillmentSection"] [id^="store-name-"],
  #pageBodyContainer [data-test="storeNameWithAddressPopover"] [id^="store-name-"],
  #pageBodyContainer [id^="store-name-"]
`

const findStoreId = async (timeout: number = 2000): Promise<string | null> => {
  const store = await selectorAdded({ selector: storeIdSelectors, timeout })
  if (!store) {
    return null
  }

  const matches = store.id.match(/^store-name-(?<storeId>\d+)$/)
  if (!matches || !matches.groups || !matches.groups.storeId) {
    return null
  }

  return matches.groups.storeId
}

const findSku = (href?: string): string | null => {
  const meta = document.querySelector<HTMLMetaElement>(`meta[property="al:ios:url"]`)
  if (meta?.content) {
    const metaUrl = new URL(meta.content)
    const skuId = metaUrl.searchParams.get("id")
    if (skuId) {
      return skuId
    }
  }

  if (href) {
    const url = new URL(href)
    const matches = url.pathname.match(/^\/p\/.*\/.*\/A-(?<sku>\d+)$/)
    if (matches?.groups?.sku) {
      return matches.groups.sku
    }
  }

  return null
}

export const productCallback = async (href: string) => {
  const sku = findSku(href)
  if (sku) {
    console.log("Likely found product with SKU", sku)
    const storeId = await findStoreId()
    let store: NearbyInventorySearchProductStore | undefined = undefined
    if (storeId) {
      console.log("Likely found location with identifier", storeId)
      store = {
        identifier: storeId,
      }
    }

    const products = findProducts()
    const productSchema = products.find(product => product.sku == sku)
    let inventoryState: InventoryState | undefined = undefined

    // Broadcast inventory state
    if (productSchema) {
      inventoryState = calculateInventoryState(productSchema)
      broadcastInventoryState(inventoryState)
    } else {
      broadcastInventoryState(InventoryState.Unknown)
    }

    // Add the Is In Stock button once selector is matched on page, even if findNearbyInventory is fired
    selectorAdded({
      selector: `
        [data-test="showInStockPrimaryButton"],
        [data-test="quantity-picker"],
        [data-test="scheduledDeliveryButton"],
        [data-test="orderPickupButton"],
        button[id^="addToCartButtonOrTextIdFor"]
      `
    }).then(addToCartButton => {
      if (addToCartButton?.parentElement) {
        const element = insertIsInStockButton(addToCartButton.parentElement, { inventoryState })
        element.style.marginTop = "6px"
      } else {
        console.log("Add to cart button not found")
        // Insert somewhere else?
      }
    })

    const nearbyInventoryRequest: NearbyInventoryProductRequest = {
      context: {
        url: href,
        userAgent: navigator.userAgent,
      },
      product: {
        retailer: Retailer.Target,
        sku,
        store,
      },
      productSchema,
    }

    findNearbyInventory(nearbyInventoryRequest)
  }
}

// Can we detect store location changing and re-issue request?
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action == MessageAction.URLChanged) {
    console.log("URL changed to", request.url)

    productCallback(request.url)
  } else {
    console.log("Unknown action", request.action)
  }
})

// Detect page transitions or DOM changes for single page based applications.
const { observe, disconnect } = observeSelector(`meta[property="al:ios:url"]`, (element: ObservableElement) => {
  const metaElement = element as unknown as HTMLMetaElement

  if (metaElement.content) {
    const metaUrl = new URL(metaElement.content)
    const skuId = metaUrl.searchParams.get("id")
    if (skuId) {
      const anchor = document.querySelector<HTMLAnchorElement>(`a[href$="A-${skuId}"`)
      if (anchor?.href) {
        productCallback(anchor.href)
      }
    }
  }
})

const run = (runLoaded?: boolean) => {
  observe()
}

// // Run product location on page load
run()

// // Once user leaves the page, disconnect the MutationObserver until user returns to tab.
window.addEventListener('blur', disconnect)

// // Once user returns to the page, start the MutationObserver again and re-process page for updated chrome action icon.
window.addEventListener('focus', () => {
  run(true)
})
