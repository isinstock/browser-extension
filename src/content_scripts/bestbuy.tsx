import browser from 'webextension-polyfill'

import {MessageAction} from '../@types/messages'
import {ObservableElement} from '../@types/observables'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import ExclusiveValidationRequestCache from '../utils/exclusive-validation-request-cache'
import {observeSelector} from '../utils/observers'
import {notFoundCallback} from '../utils/products'

const validationRequests = new ExclusiveValidationRequestCache()

/**
 * Transforms a Best Buy product URL from the /product/ format to the /site/ format.
 *
 * Input:  https://www.bestbuy.com/product/scuf-envision-pro-v1-wireless-gaming-controller-for-pc-steel-gray/J3RZQZR92W
 * Output: https://www.bestbuy.com/site/scuf-envision-pro-v1-wireless-gaming-controller-for-pc-steel-gray/1234567.p
 */
const transformBestBuyUrl = (url: string, sku: string): string => {
  try {
    const urlObj = new URL(url)
    // Replace /product/ with /site/ in the pathname
    const pathParts = urlObj.pathname.split('/')
    // Find and replace 'product' with 'site'
    const productIndex = pathParts.indexOf('product')
    if (productIndex !== -1) {
      pathParts[productIndex] = 'site'
    }
    // Replace the last segment (the ID) with the SKU + .p
    if (pathParts.length > 0) {
      pathParts[pathParts.length - 1] = `${sku}.p`
    }
    urlObj.pathname = pathParts.join('/')
    return urlObj.toString()
  } catch (error) {
    console.error('Failed to transform Best Buy URL:', error)
    return url
  }
}

/**
 * Extracts the SKU from the #product-schema JSON-LD element.
 * Returns the SKU and transformed URL if found, null otherwise.
 */
const extractSkuFromProductSchema = (): {sku: string; transformedUrl: string} | null => {
  const productSchema = document.querySelector('#product-schema')
  const textContent = productSchema?.textContent ?? ''
  if (textContent === '') {
    return null
  }

  try {
    const json = JSON.parse(textContent)
    if (json.sku && json.url) {
      const transformedUrl = transformBestBuyUrl(json.url, json.sku)
      return {sku: json.sku, transformedUrl}
    }
  } catch (error) {
    console.error('Failed to parse product schema JSON:', error, 'with textContent:', textContent)
  }

  return null
}

// We're observing changes to the DOM to know when to insert the button.
//
// #product-schema - The product schema script element containing JSON-LD with SKU information.
const options: MutationObserverInit = {
  attributes: false,
  childList: true,
  subtree: true,
}
const {search, observe, disconnect} = observeSelector(
  `script[type="application/ld+json"]`,
  async (observedElements: ObservableElement[], containsProductCandidates: boolean) => {
    const skuData = extractSkuFromProductSchema()
    console.warn('skuData', skuData)
    if (skuData) {
      console.debug('observeSelector.callback: Product SKU found in #product-schema', skuData)
      validationRequests.fetchWithLock(skuData.transformedUrl, productValidation => {
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
  options,
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
