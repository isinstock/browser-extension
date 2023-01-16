import {MessageAction} from '../@types/messages'
import {observeSelector} from '../utils/observers'
import {loadProduct, notFoundCallback, productCallback, searchProducts} from '../utils/products'

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === MessageAction.URLChanged) {
    console.log('URL changed to', request.url)
  } else {
    console.log('Unknown action', request.action)
  }
})

// Detect page transitions or DOM changes for single page based applications.
const {observe, disconnect} = observeSelector(`script[type="application/ld+json"]`, element => {
  const product = loadProduct(element)
  if (product) {
    productCallback(product)
  }
})

const run = (runFired?: boolean) => {
  searchProducts({runFired, productCallback, notFoundCallback})
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
