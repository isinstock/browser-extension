import {HTTPRequest, Page} from 'puppeteer'

export const isValidationRequest = (request: HTTPRequest) => {
  return request.url() === 'https://isinstock.com/api/products/validations' && request.method() === 'POST'
}

export const getButtonState = async (page: Page) => {
  return page.evaluate(() => {
    const button = document.querySelector('#isinstock-button')
    if (!button) return null

    const shadowRoot = button.shadowRoot
    if (!shadowRoot) return null

    const element = shadowRoot.querySelector('a[data-inventory-state-normalized]') as HTMLLinkElement
    return {
      inventoryState: element?.dataset.inventoryState,
      inventoryStateNormalized: element?.dataset.inventoryStateNormalized,
      textContent: element?.textContent,
      target: element?.target,
      rel: element?.rel,
      href: element?.href,
    }
  })
}

export const interceptValidationRequests = (page: Page) => {
  const requests: HTTPRequest[] = []
  page.on('request', (interceptedRequest: HTTPRequest) => {
    if (interceptedRequest.isInterceptResolutionHandled()) {
      return
    }
    if (isValidationRequest(interceptedRequest)) {
      requests.push(interceptedRequest)
    }
    interceptedRequest.continue()
  })
  return requests
}
