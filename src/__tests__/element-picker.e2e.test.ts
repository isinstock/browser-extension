import path from 'node:path'
import {type BrowserContext, type Page, type Worker, chromium} from 'playwright'
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest'
import {ElementPickerCommand, MessageAction} from '../@types/messages'

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

  async function activatePicker(worker: Worker, tabId: number): Promise<string> {
    const sessionId = `test-session-${Date.now()}`
    await worker.evaluate(
      async (args: {tid: number; sid: string; action: string}) => {
        await chrome.tabs.sendMessage(args.tid, {
          action: args.action,
          sessionId: args.sid,
          useSidePanel: false,
        })
      },
      {tid: tabId, sid: sessionId, action: MessageAction.StartElementPicker},
    )
    return sessionId
  }

  async function setPickerMode(worker: Worker, tabId: number, sessionId: string, mode: string): Promise<void> {
    await worker.evaluate(
      async (args: {tid: number; sid: string; mode: string; action: string; command: string}) => {
        await chrome.tabs.sendMessage(args.tid, {
          action: args.action,
          sessionId: args.sid,
          command: args.command,
          mode: args.mode,
        })
      },
      {
        tid: tabId,
        sid: sessionId,
        mode,
        action: MessageAction.ElementPickerCommand,
        command: ElementPickerCommand.SetMode,
      },
    )
  }

  async function getSelectionCount(): Promise<number> {
    return page.evaluate(() => {
      const panelHost = Array.from(document.documentElement.children).find(
        el => el instanceof HTMLElement && el.shadowRoot !== null,
      ) as HTMLElement | null
      if (!panelHost?.shadowRoot) return 0
      return panelHost.shadowRoot.querySelectorAll('.selector-row').length
    })
  }

  async function getOverlayCount(): Promise<number> {
    return page.evaluate(() => {
      return document.querySelectorAll('[style*="z-index: 2147483645"]').length
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

describe('Element Picker Click Behavior', () => {
  let context: BrowserContext
  let page: Page

  beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--headless=new'],
    })
  })

  beforeEach(async () => {
    page = await context.newPage()
  })

  afterAll(async () => {
    await context.close()
  })

  async function getServiceWorker(): Promise<Worker> {
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

  async function injectAndActivatePicker(worker: Worker, tabId: number): Promise<string> {
    await worker.evaluate(async (tid: number) => {
      await chrome.scripting.executeScript({
        target: {tabId: tid},
        files: ['content_scripts/element_picker.js'],
      })
    }, tabId)

    const sessionId = `test-session-${Date.now()}`
    await worker.evaluate(
      async (args: {tid: number; sid: string; action: string}) => {
        await chrome.tabs.sendMessage(args.tid, {
          action: args.action,
          sessionId: args.sid,
          useSidePanel: false,
        })
      },
      {tid: tabId, sid: sessionId, action: MessageAction.StartElementPicker},
    )
    return sessionId
  }

  async function setPickerMode(worker: Worker, tabId: number, sessionId: string, mode: string): Promise<void> {
    await worker.evaluate(
      async (args: {tid: number; sid: string; mode: string; action: string; command: string}) => {
        await chrome.tabs.sendMessage(args.tid, {
          action: args.action,
          sessionId: args.sid,
          command: args.command,
          mode: args.mode,
        })
      },
      {
        tid: tabId,
        sid: sessionId,
        mode,
        action: MessageAction.ElementPickerCommand,
        command: ElementPickerCommand.SetMode,
      },
    )
  }

  async function getSelectionCount(): Promise<number> {
    return page.evaluate(() => {
      const panelHost = Array.from(document.documentElement.children).find(
        el => el instanceof HTMLElement && el.shadowRoot !== null,
      ) as HTMLElement | null
      if (!panelHost?.shadowRoot) return 0
      return panelHost.shadowRoot.querySelectorAll('.selector-row').length
    })
  }

  async function getOverlayCount(): Promise<number> {
    return page.evaluate(() => {
      return document.querySelectorAll('[style*="z-index: 2147483645"]').length
    })
  }

  test('clicking an element in click mode creates a selection', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    await injectAndActivatePicker(worker, tabId)

    expect(await getSelectionCount()).toBe(0)
    expect(await getOverlayCount()).toBe(0)

    await page.click('h1')

    expect(await getSelectionCount()).toBe(1)
    expect(await getOverlayCount()).toBe(1)
  })

  test('clicking an element in advanced mode creates a selection', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    const sessionId = await injectAndActivatePicker(worker, tabId)

    await setPickerMode(worker, tabId, sessionId, 'advanced')

    expect(await getSelectionCount()).toBe(0)
    expect(await getOverlayCount()).toBe(0)

    await page.click('h1')

    expect(await getSelectionCount()).toBe(1)
    expect(await getOverlayCount()).toBe(1)
  })

  test('clicking a selected element in advanced mode removes it', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    const sessionId = await injectAndActivatePicker(worker, tabId)

    await setPickerMode(worker, tabId, sessionId, 'advanced')

    await page.click('h1')
    expect(await getSelectionCount()).toBe(1)
    expect(await getOverlayCount()).toBe(1)

    await page.click('h1')
    // Wait for the fadeOut animation to complete and the row to be removed
    await page.waitForTimeout(300)
    expect(await getSelectionCount()).toBe(0)
    expect(await getOverlayCount()).toBe(0)
  })

  test('clicking a link in advanced mode does not navigate away', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    const sessionId = await injectAndActivatePicker(worker, tabId)

    await setPickerMode(worker, tabId, sessionId, 'advanced')

    const urlBefore = page.url()
    await page.click('a')
    await page.waitForTimeout(500)

    expect(page.url()).toBe(urlBefore)
    expect(await getSelectionCount()).toBe(1)
  })

  test('beforeunload is not prevented when there are no selections', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    await injectAndActivatePicker(worker, tabId)

    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', {cancelable: true})
      window.dispatchEvent(event)
      return event.defaultPrevented
    })

    expect(prevented).toBe(false)
  })

  test('beforeunload is prevented when there are selections', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    await injectAndActivatePicker(worker, tabId)

    await page.click('h1')
    expect(await getSelectionCount()).toBe(1)

    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', {cancelable: true})
      window.dispatchEvent(event)
      return event.defaultPrevented
    })

    expect(prevented).toBe(true)
  })

  test('beforeunload is not prevented after selection is removed', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    await injectAndActivatePicker(worker, tabId)

    await page.click('h1')
    expect(await getSelectionCount()).toBe(1)

    // Remove the selection by clicking the same element
    await page.click('h1')
    await page.waitForTimeout(300)
    expect(await getSelectionCount()).toBe(0)

    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', {cancelable: true})
      window.dispatchEvent(event)
      return event.defaultPrevented
    })

    expect(prevented).toBe(false)
  })

  test('multiple selections get different badge colors', async () => {
    await page.goto('https://example.com', {waitUntil: 'domcontentloaded'})
    const worker = await getServiceWorker()
    const tabId = await getActiveTabId(worker)
    await injectAndActivatePicker(worker, tabId)

    await page.click('h1')
    await page.click('p')

    const badgeColors = await page.evaluate(() => {
      const overlays = document.querySelectorAll('[style*="z-index: 2147483645"]')
      return Array.from(overlays).map(overlay => {
        const badge = overlay.querySelector('[data-overlay-badge]') as HTMLElement | null
        return badge?.style.background ?? ''
      })
    })

    expect(badgeColors.length).toBe(2)
    expect(badgeColors[0]).not.toBe(badgeColors[1])
  })
})
