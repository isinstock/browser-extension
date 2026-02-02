import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import {registerContentScript} from '../utils/content-script'
import {isProduct, notFoundCallback, SELECTOR} from '../utils/products'

registerContentScript(SELECTOR, async (validationRequests, productCandidates, containsProductCandidates) => {
  const products = productCandidates.filter(productCandidate => isProduct(productCandidate))
  if (products.length > 0) {
    console.debug('observeSelector.callback: Products found in structured data', products)
    validationRequests.fetchWithLock(window.location.href, productValidation => {
      insertIsInStockButton({productValidation})
    })
    return true
  } else if (!containsProductCandidates) {
    console.debug('observeSelector.callback: No product candidates found in DOM.')
    removeIsInStockButton()
    notFoundCallback()
    return true
  }
  return true
})
