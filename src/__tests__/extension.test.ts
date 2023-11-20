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
