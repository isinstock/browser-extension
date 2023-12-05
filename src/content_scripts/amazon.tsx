import browser from 'webextension-polyfill'

import {MessageAction} from '../@types/messages'
import {ObservableElement} from '../@types/observables'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import ExclusiveValidationRequestCache from '../utils/exclusive-validation-request-cache'
import {observeSelector} from '../utils/observers'
import {notFoundCallback} from '../utils/products'

const validationRequests = new ExclusiveValidationRequestCache()

// We're observing changes to the DOM to know when to insert the button.
//
// link[rel="canonical"] - The canonical link element. This is the link that points to the canonical URL of the page, which contains the URL.
// #ppd - The product details div. This is the div that contains the product title and price.
const {search, observe, disconnect} = observeSelector(
  `link[rel="canonical"], #ppd`,
  async (observedElements: ObservableElement[], containsProductCandidates: boolean) => {
    if (/\/dp\//.test(window.location.href)) {
      console.debug('observeSelector.callback: Product found in link', window.location.href)
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
