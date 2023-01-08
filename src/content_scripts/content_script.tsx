import { ItemAvailability, OfferItemCondition, Product, Offer, AggregateOffer } from "../@types/linked-data";
import { findOffer, isAggregateOffer, isInStock, isMultipleOffers, isNewCondition, isOffer } from "../utils/helpers";
import { observeProducts } from "../utils/observers"
import { calculateInventoryState } from "../utils/inventory-state";
import { searchProducts, notFoundCallback, productCallback } from "../utils/products";
import { insertWidget } from "../elements/widget";
import { MessageAction } from "../@types/messages";
import { InventoryState } from "../@types/inventory-states";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action == MessageAction.URLChanged) {
    console.log("URL changed to", request.url)
  } else {
    console.log("Unknown action", request.action)
  }
})

// Detect page transitions or DOM changes for single page based applications.
const { observe, disconnect } = observeProducts(productCallback)

const run = (runLoaded?: boolean) => {
  searchProducts({ runLoaded, productCallback, notFoundCallback })
  observe()
}

// Run product location on page load
run()

// Once user leaves the page, disconnect the MutationObserver until user returns to tab.
window.addEventListener('blur', disconnect)

// Once user returns to the page, start the MutationObserver again and re-process page for updated chrome action icon.
window.addEventListener('focus', () => {
  run(true)
})
