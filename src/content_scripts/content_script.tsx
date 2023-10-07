import {MessageAction} from '../@types/messages'
import {observeSelector} from '../utils/observers'
import {loadProduct, notFoundCallback, productCallback, searchProducts} from '../utils/products'

chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
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

run()

// Once user leaves the page, disconnect the MutationObserver until user returns focus.
window.addEventListener('blur', disconnect)

// Once the user returns focus, reconnect the MutationObserver.
window.addEventListener('focus', observe)
