import {Browser, HTTPRequest, Page} from 'puppeteer'

import {createBrowser} from '../utils/browser'

const isValidationRequest = (request: HTTPRequest) => {
  return request.url() === 'https://isinstock.com/api/products/validations' && request.method() === 'POST'
}

describe('Browser Extension Test', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await createBrowser()
  })

  beforeEach(async () => {
    page = await browser.newPage()
  })

  afterEach(async () => {
    await page.close()
  })

  afterAll(async () => {
    if (process.env.CHROME_DEVTOOLS_ID === undefined || process.env.CHROME_DEVTOOLS_ID === '') {
      await browser.close()
    }
  })

  test('extension is installable and renders correctly', async () => {
    await page.goto('https://isinstock.com/store/products/available')

    expect(await page.waitForSelector('#isinstock-button')).not.toBe(null)
  })

  test('extension sends correct headers for validation request', async () => {
    await page.setRequestInterception(true)
    let interceptedValidationsRequest: HTTPRequest | undefined
    page.on('request', (interceptedRequest: HTTPRequest) => {
      if (isValidationRequest(interceptedRequest)) {
        interceptedValidationsRequest = interceptedRequest
      }
      interceptedRequest.continue()
    })

    await page.goto('https://isinstock.com/store/products/available', {waitUntil: 'networkidle0'})

    const headers = interceptedValidationsRequest?.headers() ?? {}
    expect(headers['accept']).toBe('application/json')
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-extension-version']).not.toBe(null)
  })

  test('available product renders available button', async () => {
    await page.goto('https://isinstock.com/store/products/available', {waitUntil: 'networkidle0'})
    await page.waitForSelector('#isinstock-button')
    const result = await page.evaluate(() => {
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

    const href = new URL(result?.href ?? '')

    expect(result?.inventoryState).toBe('InStock')
    expect(result?.inventoryStateNormalized).toBe('available')
    expect(result?.textContent).toBe('In Stock')
    expect(result?.target).toBe('_blank')
    expect(result?.rel).toBe('noreferrer')
    expect(href.protocol).toBe('https:')
    expect(href.hostname).toBe('isinstock.com')
    expect(href.pathname).toBe('/track')
    expect(href.searchParams.get('url')).toBe('https://isinstock.com/store/products/available')
    expect(href.searchParams.get('utm_campaign')).toBe('web_extension')
  })

  test('unavailable product renders unavailable button', async () => {
    await page.goto('https://isinstock.com/store/products/unavailable')
    await page.waitForSelector('#isinstock-button')
    const result = await page.evaluate(() => {
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

    const href = new URL(result?.href ?? '')

    expect(result?.inventoryState).toBe('OutOfStock')
    expect(result?.inventoryStateNormalized).toBe('unavailable')
    expect(result?.textContent).toBe('Notify Me When Available')
    expect(result?.target).toBe('_blank')
    expect(result?.rel).toBe('noreferrer')
    expect(href.protocol).toBe('https:')
    expect(href.hostname).toBe('isinstock.com')
    expect(href.pathname).toBe('/track')
    expect(href.searchParams.get('url')).toBe('https://isinstock.com/store/products/unavailable')
    expect(href.searchParams.get('utm_campaign')).toBe('web_extension')
  })

  test('pre-order product renders pre-order button', async () => {
    await page.goto('https://isinstock.com/store/products/pre-order', {waitUntil: 'networkidle0'})
    await page.waitForSelector('#isinstock-button')
    const result = await page.evaluate(() => {
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

    const href = new URL(result?.href ?? '')

    expect(result?.inventoryState).toBe('PreOrder')
    expect(result?.inventoryStateNormalized).toBe('available')
    expect(result?.textContent).toBe('Pre-Order')
    expect(result?.target).toBe('_blank')
    expect(result?.rel).toBe('noreferrer')
    expect(href.protocol).toBe('https:')
    expect(href.hostname).toBe('isinstock.com')
    expect(href.pathname).toBe('/track')
    expect(href.searchParams.get('url')).toBe('https://isinstock.com/store/products/pre-order')
    expect(href.searchParams.get('utm_campaign')).toBe('web_extension')
  })

  test('extension makes validation request to isinstock', async () => {
    await page.setRequestInterception(true)
    let interceptedValidationsRequest: HTTPRequest | undefined
    page.on('request', (interceptedRequest: HTTPRequest) => {
      if (isValidationRequest(interceptedRequest)) {
        interceptedValidationsRequest = interceptedRequest
      }
      interceptedRequest.continue()
    })

    await page.goto('https://isinstock.com/store/products/available', {waitUntil: 'networkidle0'})

    expect(interceptedValidationsRequest).toBeDefined()
    expect(interceptedValidationsRequest?.method()).toBe('POST')
    expect(interceptedValidationsRequest?.postData()).toBe(`{"url":"https://isinstock.com/store/products/available"}`)
  })

  // TODO: Mock the HTTP request for this test
  test('retailer with specific CSS selector inserts button after CSS selector', async () => {
    await page.goto('https://isinstock.com/store/products/available', {waitUntil: 'networkidle0'})
    await page.waitForSelector('#isinstock-button')
    const result = await page.evaluate(() => {
      const button = document.querySelector('#isinstock-button')
      if (!button) return null

      const insertedAfter = button.previousElementSibling
      if (!insertedAfter) return null

      return {
        id: insertedAfter?.id,
      }
    })

    expect(result?.id).toBe('add-to-cart')
  })

  // TODO: Mock the HTTP request for this test
  test('retailer without specific CSS selector inserts button in fixed position', async () => {
    await page.goto('https://shop.porsche.com/us/en-US/p/porsche-911-gt3-992-ltd-P-WAP0231510M002/WAP0231510M002')
    await page.waitForSelector('#isinstock-button')
    const position = await page.evaluate(() => {
      const button = document.querySelector('#isinstock-button') as HTMLElement
      return button.style.position
    })

    expect(position).toBe('fixed')
  })

  test('popstate to restore page searches for products', async () => {
    await page.goto('https://isinstock.com/store/products/unavailable', {waitUntil: 'networkidle0'})
    await page.waitForSelector('#isinstock-button')

    await page.goto('https://isinstock.com/store/products', {waitUntil: 'networkidle0'})
    await page.goBack()
    const element = await page.waitForSelector('#isinstock-button')

    expect(element).not.toBe(null)
  })

  test('monitors URL changes when no other events are fired', async () => {
    await page.setRequestInterception(true)
    const interceptedValidationsRequests: HTTPRequest[] = []
    page.on('request', (interceptedRequest: HTTPRequest) => {
      if (interceptedRequest.isInterceptResolutionHandled()) {
        return
      }

      if (isValidationRequest(interceptedRequest)) {
        const postData = JSON.parse(interceptedRequest.postData() ?? '{}')
        interceptedValidationsRequests.push(postData.url)
      }

      interceptedRequest.continue()
    })

    await page.goto('https://shop.spacex.com/collections/outerwear/products/spacex-vehicle-holiday-sweater', {
      waitUntil: 'networkidle0',
    })
    await page.click('.ProductForm__Variants button')
    await page.click('.OptionSelector button[data-value=S]')

    await page.click('.ProductForm__Variants button')
    await page.click('.OptionSelector button[data-value=M]')
    await page.waitForRequest(request => isValidationRequest(request))

    expect(interceptedValidationsRequests).toStrictEqual([
      'https://shop.spacex.com/collections/outerwear/products/spacex-vehicle-holiday-sweater',
      'https://shop.spacex.com/collections/outerwear/products/spacex-vehicle-holiday-sweater?variant=40885795684431',
      'https://shop.spacex.com/collections/outerwear/products/spacex-vehicle-holiday-sweater?variant=40885795717199',
    ])
  })
})
