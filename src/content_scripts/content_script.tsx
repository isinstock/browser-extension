import {MessageAction} from '../@types/messages'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import {observeSelector} from '../utils/observers'
import {findProducts, loadProduct, notFoundCallback, productCallback, searchProducts} from '../utils/products'

chrome.runtime.onMessage.addListener(async (request, _sender, _sendResponse) => {
  if (request.action === MessageAction.URLChanged) {
    console.log('URL changed to', request.url)
    const products = findProducts()
    if (products.length > 0) {
      const productValidation = await productCallback({
        url: request.url,
      })
      insertIsInStockButton({productValidation})
    } else {
      removeIsInStockButton()
    }
  } else {
    console.log('Unknown action', request.action)
  }
})

// Detect page transitions or DOM changes for single page based applications.
const {observe, disconnect} = observeSelector(`script[type="application/ld+json"]`, async element => {
  const product = loadProduct(element)
  if (product) {
    const productValidation = await productCallback({
      url: window.location.href,
      product,
    })
    insertIsInStockButton({productValidation})
  } else {
    console.log('Could not detect product in structured data', product)
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
