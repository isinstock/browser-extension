import 'expect-puppeteer'

import {HTTPRequest} from 'puppeteer'

describe('Browser Extension Test', () => {
  afterEach(async () => {
    page.off('request')
  })

  test.only('extension is installable and renders correctly', async () => {
    await page.goto('http://localhost:3100/available')

    expect(await page.waitForSelector('#isinstock-button')).not.toBe(null)
  })

  test.only('extension sends correct headers for validation request', async () => {
    await page.setRequestInterception(true)
    let interceptedValidationsRequest: HTTPRequest | undefined
    page.on('request', interceptedRequest => {
      if (interceptedRequest.url() === 'http://localhost:3100/api/products/validations') {
        interceptedValidationsRequest = interceptedRequest
      }
      interceptedRequest.continue()
    })

    await page.goto('http://localhost:3100/available')

    const headers = interceptedValidationsRequest?.headers() ?? {}
    expect(headers['accept']).toBe('application/json')
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-extension-version']).not.toBe(null)
  })

  test.only('available product renders available button', async () => {
    await page.goto('http://localhost:3100/available')
    await page.waitForSelector('#isinstock-button')
    const result = await page.evaluate(() => {
      const button = document.querySelector('#isinstock-button')
      if (!button) return null

      const shadowRoot = button.shadowRoot
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
    expect(href.searchParams.get('url')).toBe('http://localhost:3100/available')
    expect(href.searchParams.get('utm_campaign')).toBe('web_extension')
  })

  test.only('unavailable product renders unavailable button', async () => {
    await page.goto('http://localhost:3100/unavailable')
    await page.waitForSelector('#isinstock-button')
    const result = await page.evaluate(() => {
      const button = document.querySelector('#isinstock-button')
      if (!button) return null

      const shadowRoot = button.shadowRoot
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
    expect(href.searchParams.get('url')).toBe('http://localhost:3100/unavailable')
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

    await page.goto('https://isinstock.com/store/products/available')

    expect(interceptedValidationsRequest).toBeDefined()
    expect(interceptedValidationsRequest?.method()).toBe('POST')
    expect(interceptedValidationsRequest?.postData()).toBe(`{"url":"https://isinstock.com/store/products/available"}`)
  })

  // TODO: Mock the HTTP request for this test
  test('retailer with specific CSS selector inserts button after CSS selector', async () => {
    await page.goto('https://isinstock.com/store/products/available')
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
    jest.setTimeout(30000)

    await page.goto('https://shop.porsche.com/us/en-US/p/porsche-911-gt3-992-ltd-P-WAP0231510M002/WAP0231510M002')
    await page.waitForSelector('#isinstock-button')
    const position = await page.evaluate(() => {
      const button = document.querySelector('#isinstock-button') as HTMLElement
      return button.style.position
    })

    expect(position).toBe('fixed')
  })
})
