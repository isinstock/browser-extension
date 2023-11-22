import browser from 'webextension-polyfill'

import {MessageAction} from '../@types/messages'
import {ObservableElement} from '../@types/observables'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import ExclusiveValidationRequestCache from '../utils/exclusive-validation-request-cache'
import {observeSelector} from '../utils/observers'
import {isProduct, notFoundCallback, SELECTOR} from '../utils/products'

const validationRequests = new ExclusiveValidationRequestCache()

// We're observing changes to the DOM to know when to validate products.
const {search, observe, disconnect} = observeSelector(
  SELECTOR,
  async (productCandidates: ObservableElement[], containsProductCandidates: boolean) => {
    const products = productCandidates.filter(productCandidate => isProduct(productCandidate))
    if (products.length > 0) {
      console.debug('observeSelector.callback: Products found in structured data', products)
      validationRequests.fetchWithLock(window.location.href, productValidation => {
        insertIsInStockButton({productValidation})
      })
    } else if (!containsProductCandidates) {
      // Because we don't fire the MutationObserver twice on the same <script>, it's possible there are products on the
      // page and we should not have any side effects that clear state in this callback.
      console.debug('observeSelector.callback: No product candidates found in DOM.')
      removeIsInStockButton()
      notFoundCallback()
    }
  },
)

window.addEventListener('beforeunload', () => validationRequests.cancelAllRequests())
window.addEventListener('focus', observe)
window.addEventListener('blur', disconnect)
window.addEventListener('pageshow', async event => {
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

window.addEventListener('popstate', event => {
  console.debug('popstate: The popstate event is fired when the active history entry changes.')
  search({event})
})

browser.runtime.onMessage.addListener(async (request, _sender, _sendResponse) => {
  if (request.action === MessageAction.URLChanged) {
    const event = new CustomEvent('urlChanged', {detail: {request}})
    search({event, filterFired: false})
  } else {
    console.debug('Unknown action', request.action)
  }
})
