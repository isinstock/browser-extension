import 'expect-puppeteer'

import {HTTPRequest} from 'puppeteer'

describe('Browser Extension Test', () => {
  afterEach(async () => {
    page.off('request')
  })

  test('extension is installable and renders correctly', async () => {
    await page.goto('https://isinstock.com/store/products/available')

    expect(await page.waitForSelector('#isinstock-button')).not.toBe(null)
  })

  test('available product renders available button', async () => {
    await page.goto('https://isinstock.com/store/products/available', {waitUntil: 'networkidle0'})
    const result = await page.evaluate(() => {
      const hostElement = document.querySelector('#isinstock-button')
      if (!hostElement) return null

      const shadowRoot = hostElement.shadowRoot
      if (!shadowRoot) return null

      const element = shadowRoot.querySelector('a[data-inventory-state-normalized]') as HTMLLinkElement
      return {
        inventoryStateNormalized: element?.dataset.inventoryStateNormalized,
        textContent: element?.textContent,
        target: element?.target,
        rel: element?.rel,
        href: element?.href,
      }
    })

    const href = new URL(result?.href ?? '')

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
    await page.goto('https://isinstock.com/store/products/unavailable', {waitUntil: 'networkidle0'})
    const result = await page.evaluate(() => {
      const hostElement = document.querySelector('#isinstock-button')
      if (!hostElement) return null

      const shadowRoot = hostElement.shadowRoot
      if (!shadowRoot) return null

      const element = shadowRoot.querySelector('a[data-inventory-state-normalized]') as HTMLLinkElement
      return {
        inventoryStateNormalized: element?.dataset.inventoryStateNormalized,
        textContent: element?.textContent,
        target: element?.target,
        rel: element?.rel,
        href: element?.href,
      }
    })

    const href = new URL(result?.href ?? '')

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
    page.on('request', interceptedRequest => {
      if (interceptedRequest.url() === 'https://isinstock.com/api/products/validations') {
        interceptedValidationsRequest = interceptedRequest
      }
      interceptedRequest.continue()
    })

    await page.goto('https://isinstock.com/store/products/available', {waitUntil: 'networkidle0'})

    expect(interceptedValidationsRequest).toBeDefined()
    expect(interceptedValidationsRequest?.method()).toBe('POST')
    expect(interceptedValidationsRequest?.postData()).toBe(`{"url":"https://isinstock.com/store/products/available"}`)
  })

  test('extension sends correct headers for validation request', async () => {
    await page.setRequestInterception(true)
    let interceptedValidationsRequest: HTTPRequest | undefined
    page.on('request', interceptedRequest => {
      if (interceptedRequest.url() === 'https://isinstock.com/api/products/validations') {
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
})
