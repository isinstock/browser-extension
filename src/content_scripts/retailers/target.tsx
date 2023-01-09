import { findProducts } from "../../utils/products";
import { MessageAction } from "../../@types/messages";
import { InventoryState } from "../../@types/inventory-states";
import { findNearbyInventory } from "../../utils/nearby-inventory";
import { NearbyInventoryProductRequest, NearbyInventorySearchProductStore } from "../../@types/api";
import { Retailer } from "../../@types/retailers";
import { selectorAdded } from "../../utils/observers";

const storeIdSelectors = `
  #pageBodyContainer [data-test="@web/AddToCart/FulfillmentSection"] [id^="store-name-"],
  #pageBodyContainer [data-test="storeNameWithAddressPopover"] [id^="store-name-"],
  #pageBodyContainer [id^="store-name-"]
`

const findStoreId = async (): Promise<string | null> => {
  const store = await selectorAdded(storeIdSelectors)
  if (!store) {
    return null
  }

  const matches = store.id.match(/^store-name-(?<storeId>\d+)$/)
  if (!matches || !matches.groups || !matches.groups.storeId) {
    return null
  }

  return matches.groups.storeId
}

const findSku = (href: string): string | null => {
  const url = new URL(href)
  const matches = url.pathname.match(/^\/p\/.*\/.*\/A-(?<sku>\d+)$/)
  if (!matches || !matches.groups || !matches.groups.sku) {
    return null
  }

  return matches.groups.sku
}

// Can we detect store location changing and re-issue request?
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action == MessageAction.URLChanged) {
    console.log("URL changed to", request.url)

    const sku = findSku(request.url)
    if (sku) {
      console.log("Likely found product with SKU", sku)
      const storeId = await findStoreId()
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
          retailer: Retailer.Target,
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

console.log("target")


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
