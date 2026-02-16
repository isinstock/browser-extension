import path from 'node:path'
import {type BrowserContext, type Page, type Worker, chromium} from 'playwright'
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest'

const extensionPath = path.resolve(__dirname, '../../dist/chrome')

describe('Element Picker Injection', () => {
  let context: BrowserContext
  let page: Page

  beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        // Headless mode with extensions requires the new headless
        '--headless=new',
      ],
    })
  })

  beforeEach(async () => {
    page = await context.newPage()
  })

  afterAll(async () => {
    await context.close()
  })

  async function getServiceWorker(): Promise<Worker> {
    // The service worker may already be available or we may need to wait for it
    let worker = context.serviceWorkers().find(w => w.url().includes('chrome-extension://'))
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', {
        predicate: w => w.url().includes('chrome-extension://'),
      })
    }
    return worker
  }

  async function getActiveTabId(worker: Worker): Promise<number> {
    const tabId = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true})
      return tab?.id
    })
    if (tabId === undefined) throw new Error('No active tab found')
    return tabId
  }

  async function isPickerLoaded(worker: Worker, tabId: number): Promise<boolean> {
    return worker.evaluate(async (tid: number) => {
      const results = await chrome.scripting.executeScript({
        target: {tabId: tid},
        func: () => (window as unknown as Record<string, unknown>).__isinstockPickerLoaded === true,
      })
      return results[0]?.result === true
    }, tabId)
  }

  async function injectPicker(worker: Worker, tabId: number): Promise<void> {
    await worker.evaluate(async (tid: number) => {
      await chrome.scripting.executeScript({
        target: {tabId: tid},
        files: ['content_scripts/element_picker.js'],
      })
    }, tabId)
  }

  async function countPickerPanels(): Promise<number> {
    return page.evaluate(() => {
      return Array.from(document.documentElement.children).filter(
        el => el instanceof HTMLElement && el.shadowRoot !== null,
      ).length
    })
  }

  test('picker is not loaded before injection', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)

    expect(await isPickerLoaded(worker, tabId)).toBe(false)
  })

  test('picker is loaded after injection', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)

    await injectPicker(worker, tabId)

    expect(await isPickerLoaded(worker, tabId)).toBe(true)
    expect(await countPickerPanels()).toBe(1)
  })

  test('picker flag is cleared after navigation', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)

    await injectPicker(worker, tabId)
    expect(await isPickerLoaded(worker, tabId)).toBe(true)

    await page.goto('https://www.iana.org/help/example-domains', {waitUntil: 'domcontentloaded'})

    expect(await isPickerLoaded(worker, tabId)).toBe(false)
    expect(await countPickerPanels()).toBe(0)
  })

  test('picker can be re-injected after navigation', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)

    await injectPicker(worker, tabId)
    expect(await isPickerLoaded(worker, tabId)).toBe(true)
    expect(await countPickerPanels()).toBe(1)

    await page.goto('https://www.iana.org/help/example-domains', {waitUntil: 'domcontentloaded'})
    expect(await isPickerLoaded(worker, tabId)).toBe(false)

    await injectPicker(worker, tabId)
    expect(await isPickerLoaded(worker, tabId)).toBe(true)
    expect(await countPickerPanels()).toBe(1)
  })

  test('second injection does not create duplicate DOM elements', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)

    await injectPicker(worker, tabId)
    expect(await isPickerLoaded(worker, tabId)).toBe(true)
    expect(await countPickerPanels()).toBe(1)

    // Second injection — guard prevents re-initialization
    await injectPicker(worker, tabId)

    expect(await isPickerLoaded(worker, tabId)).toBe(true)
    expect(await countPickerPanels()).toBe(1)
  })
})
