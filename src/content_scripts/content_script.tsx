import {MessageAction} from '../@types/messages'
import {ObservableElement} from '../@types/observables'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import {observeSelector} from '../utils/observers'
import {findProducts, loadProduct, notFoundCallback, productCallback, productsNotFound} from '../utils/products'

const queryProducts = async () => {
  const products = findProducts()
  if (products.length > 0) {
    const productValidation = await productCallback({
      url: window.location.href,
    })
    insertIsInStockButton({productValidation})
  } else {
    removeIsInStockButton()
    notFoundCallback()
  }
}

chrome.runtime.onMessage.addListener(async (request, _sender, _sendResponse) => {
  if (request.action === MessageAction.URLChanged) {
    console.debug('URL changed to', request.url)
    queryProducts()
  } else {
    console.debug('Unknown action', request.action)
  }
})

// Detect page transitions or DOM changes for single page based applications.

// We're observing changes to the DOM to know when to validate products.
const {observe, disconnect} = observeSelector(
  `script[type="application/ld+json"]`,
  async (elements: ObservableElement[]) => {
    const products = elements.map(element => loadProduct(element)).filter(element => element)
    if (products.length > 0) {
      const productValidation = await productCallback({
        url: window.location.href,
      })
      insertIsInStockButton({productValidation})
    } else {
      // Because we don't fire the MutationObserver twice on the same <script>, it's possible there are products on the
      // page and we should not have any side effects that clear state in this callback.
      console.debug('No products found in structured data.')
    }
  },
)

// const run = (runFired?: boolean) => {
//   searchProducts({runFired, productCallback, notFoundCallback})
//   observe()
// }

// run()
observe()

productsNotFound().then(notFoundCallback)

// Once user leaves the page, disconnect the MutationObserver until user returns focus.
window.addEventListener('blur', () => {
  disconnect()
})

// Once the user returns focus, reconnect the MutationObserver.
window.addEventListener('focus', () => {
  observe()

  productsNotFound().then(notFoundCallback)
})

window.addEventListener('pageshow', async event => {
  if (event.persisted) {
    queryProducts()

    // broadcastInventoryState(InventoryStateNormalized.Available)
    console.debug('This page was restored from the bfcache.')
  } else {
    console.log('This page was loaded normally.')
  }
})
