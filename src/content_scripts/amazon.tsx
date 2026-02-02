import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import {registerContentScript} from '../utils/content-script'
import {notFoundCallback} from '../utils/products'

registerContentScript(
  `link[rel="canonical"], #ppd`,
  async (validationRequests, _observedElements, containsProductCandidates) => {
    if (/\/dp\//.test(window.location.href)) {
      console.debug('observeSelector.callback: Product found in link', window.location.href)
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
  },
)
