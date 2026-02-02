import {Browser, HTTPRequest, Page} from 'puppeteer'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test} from 'vitest'

import {createBrowser} from '../utils/browser'
import {getButtonState, isValidationRequest} from './e2e-helpers'

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
    await page.goto('https://www.amazon.com/dp/B08G58D42M/')

    expect(await page.waitForSelector('#isinstock-button')).not.toBe(null)
  })

  test('available product renders available button', async () => {
    await page.goto('https://www.amazon.com/dp/B08G58D42M/')
    await page.waitForSelector('#isinstock-button')
    const result = await getButtonState(page)

    const href = new URL(result?.href ?? '')

    expect(result?.inventoryState).toBe('InStock')
    expect(result?.inventoryStateNormalized).toBe('available')
    expect(result?.textContent).toBe('In Stock')
    expect(result?.target).toBe('_blank')
    expect(result?.rel).toBe('noreferrer')
    expect(href.protocol).toBe('https:')
    expect(href.hostname).toBe('isinstock.com')
    expect(href.pathname).toBe('/track')
    expect(href.searchParams.get('url')).toBe(
      'https://www.amazon.com/dp/B08G58D42M?tag=isinstock02-20&linkCode=ogi&th=1&psc=1',
    )
    expect(href.searchParams.get('utm_campaign')).toBe('web_extension')
  })

  test('does not perform validation request on non-product pages', async () => {
    await page.setRequestInterception(true)
    let interceptedValidationsRequest: HTTPRequest | undefined
    page.on('request', (interceptedRequest: HTTPRequest) => {
      if (isValidationRequest(interceptedRequest)) {
        interceptedValidationsRequest = interceptedRequest
      }
      interceptedRequest.continue()
    })

    await page.goto('https://www.amazon.com/')

    expect(interceptedValidationsRequest).toBeUndefined()
  })

  test.skip('unavailable product renders unavailable button', async () => {
    await page.goto('https://isinstock.com/store/products/unavailable')
    await page.waitForSelector('#isinstock-button')
    const result = await getButtonState(page)

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

  test('extension makes validation request to isinstock', async () => {
    await page.setRequestInterception(true)
    let interceptedValidationsRequest: HTTPRequest | undefined
    page.on('request', (interceptedRequest: HTTPRequest) => {
      if (isValidationRequest(interceptedRequest)) {
        interceptedValidationsRequest = interceptedRequest
      }
      interceptedRequest.continue()
    })

    await page.goto('https://www.amazon.com/dp/B08G58D42M/', {waitUntil: 'networkidle2'})

    expect(interceptedValidationsRequest).toBeDefined()
    expect(interceptedValidationsRequest?.method()).toBe('POST')
    expect(interceptedValidationsRequest?.postData()).toBe(`{"url":"https://www.amazon.com/dp/B08G58D42M/"}`)
  })

  test('popstate to restore page searches for products', async () => {
    await page.goto('https://www.amazon.com/dp/B08G58D42M/')
    await page.waitForSelector('#isinstock-button')
    await page.goto('https://www.amazon.com/')
    await page.goBack()

    const element = await page.waitForSelector('#isinstock-button')
    expect(element).not.toBe(null)
  })

  test('monitors URL changes when no other events are fired', async () => {
    await page.setRequestInterception(true)
    const interceptedValidationsRequests: string[] = []
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

    await page.goto('https://www.amazon.com/dp/B088HH6LW5/')
    await page.click(`[data-dp-url] button, [data-asin='B0BLF2RWNV'] input.a-button-input`)
    await page.waitForRequest(request => isValidationRequest(request))

    expect(interceptedValidationsRequests).toStrictEqual([
      'https://www.amazon.com/dp/B088HH6LW5/',
      'https://www.amazon.com/dp/B0BLF2RWNV/?th=1',
    ])
  })
})
