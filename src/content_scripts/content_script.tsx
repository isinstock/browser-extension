import {ObservableElement} from '../@types/observables'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import {observeSelector} from '../utils/observers'
import {hasProducts, isProduct, notFoundCallback, productCallback, SELECTOR} from '../utils/products'

const queryProducts = async () => {
  if (hasProducts()) {
    const productValidation = await productCallback({
      url: window.location.href,
    })
    insertIsInStockButton({productValidation})
  } else {
    removeIsInStockButton()
    notFoundCallback()
  }
}

// extensionApi.runtime.onMessage.addListener(async (request, _sender, _sendResponse) => {
//   if (request.action === MessageAction.URLChanged) {
//     console.debug('URL changed to', request.url)
//     queryProducts()
//   } else {
//     console.debug('Unknown action', request.action)
//   }
// })

// Detect page transitions or DOM changes for single page based applications.

// We're observing changes to the DOM to know when to validate products.
const {search, observe, disconnect} = observeSelector(
  SELECTOR,
  async (productCandidates: ObservableElement[], containsProductCandidates: boolean) => {
    const products = productCandidates.filter(productCandidate => isProduct(productCandidate))
    if (products.length > 0) {
      console.debug('observeSelector.callback: Products found in structured data', products)
      const productValidation = await productCallback({
        url: window.location.href,
      })
      insertIsInStockButton({productValidation})
    } else if (!containsProductCandidates) {
      // Because we don't fire the MutationObserver twice on the same <script>, it's possible there are products on the
      // page and we should not have any side effects that clear state in this callback.
      console.debug('observeSelector.callback: No product candidates found in DOM.')
      notFoundCallback()
    }
  },
)

window.addEventListener('focus', observe)
window.addEventListener('blur', disconnect)

window.addEventListener('pagehide', () => {
  // console.log('unfired')
})

window.addEventListener('pageshow', async event => {
  console.log(event)
  // If persisted then it's in the bfcache, meaning the page was restored from the bfcache.
  if (event.persisted) {
    console.debug('pageshow: Page was restored from cache.')
    search({event})
  } else {
    console.debug('pageshow: Page was loaded without cache.')
    observe()
    search({event})
  }
})

window.addEventListener('unload', event => {
  // console.debug('unload: The document is being unloaded. This is the place to cancel any network requests')
})

window.addEventListener('popstate', event => {
  console.debug('popstate: The popstate event is fired when the active history entry changes.')
  // console.log(event)
  search({event})
})
