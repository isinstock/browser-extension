import puppeteer, {Browser, HTTPRequest, Page, PuppeteerLaunchOptions} from 'puppeteer'

const PUPPETEER_OPTIONS: PuppeteerLaunchOptions = {
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  product: 'chrome',
  dumpio: true,
  args: ['--no-sandbox', '--disable-gpu', `--disable-extensions-except=dist/chrome`, `--load-extension=dist/chrome`],
  defaultViewport: {
    width: 1024,
    height: 1080,
    deviceScaleFactor: 2,
  },
}

async function createBrowser() {
  if (process.env.CHROME_DEVTOOLS_ID !== undefined && process.env.CHROME_DEVTOOLS_ID !== '') {
    const browserWSEndpoint = `ws://host.docker.internal:21222/devtools/browser/${process.env.CHROME_DEVTOOLS_ID}`
    console.debug('Connecting with Chrome DevTools Protocol at %s', browserWSEndpoint)
    return puppeteer.connect({
      // Don't set any viewport and use the existing browser dimensions.
      defaultViewport: null,
      browserWSEndpoint,
    })
  }

  console.debug('Launching new %s browser at %s', PUPPETEER_OPTIONS.product, PUPPETEER_OPTIONS.executablePath)
  return puppeteer.launch(PUPPETEER_OPTIONS)
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
    await page.goto('https://isinstock.com/store/products/unavailable')
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
    expect(href.searchParams.get('url')).toBe('https://isinstock.com/store/products/unavailable')
    expect(href.searchParams.get('utm_campaign')).toBe('web_extension')
  })

  test('extension makes validation request to isinstock', async () => {
    await page.setRequestInterception(true)
    let interceptedValidationsRequest: HTTPRequest | undefined
    page.on('request', (interceptedRequest: HTTPRequest) => {
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
})
