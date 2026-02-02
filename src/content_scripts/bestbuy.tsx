import browser from 'webextension-polyfill'

import {MessageAction} from '../@types/messages'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'
import {transformBestBuyUrl} from '../utils/bestbuy'
import {registerContentScript} from '../utils/content-script'
import {notFoundCallback} from '../utils/products'

const extractSkuFromProductSchema = (): {sku: string; transformedUrl: string} | null => {
  const productSchema = document.querySelector('#product-schema')
  const textContent = productSchema?.textContent ?? ''
  if (textContent === '') {
    return null
  }

  try {
    const json = JSON.parse(textContent)
    if (json.sku != null && json.url != null) {
      const transformedUrl = transformBestBuyUrl(json.url, json.sku)
      return {sku: json.sku, transformedUrl}
    }
  } catch (error) {
    console.error('Failed to parse product schema JSON:', error, 'with textContent:', textContent)
  }

  return null
}

registerContentScript(
  `script[type="application/ld+json"]`,
  async (validationRequests, _observedElements, containsProductCandidates) => {
    const skuData = extractSkuFromProductSchema()
    console.warn('skuData', skuData)
    if (skuData) {
      console.debug('observeSelector.callback: Product SKU found in #product-schema', skuData)
      browser.runtime.sendMessage({action: MessageAction.TrackUrl, url: skuData.transformedUrl})
      validationRequests.fetchWithLock(skuData.transformedUrl, productValidation => {
        insertIsInStockButton({productValidation})
      })
      return true
    } else if (!containsProductCandidates) {
      console.debug('observeSelector.callback: No product candidates found in DOM.')
      removeIsInStockButton()
      notFoundCallback()
      return false
    }
    console.debug('observeSelector.callback: Element found but SKU data not ready, will re-process.')
    return false
  },
  {
    attributes: false,
    childList: true,
    subtree: true,
  },
)
