import browser from 'webextension-polyfill'

import {InventoryStateNormalized} from './@types/inventory-states'
import {Message, MessageAction} from './@types/messages'
import {
  browserExtensionStartup,
  createBrowserExtensionInstall,
  updateBrowserExtensionInstall,
} from './api/browser-extension-install'
import {getBrowserExtensionInstallToken, setBrowserExtensionInstallToken} from './utils/browser-extension-install-token'
import {FetchError} from './utils/fetch-error'

// Store modified URLs per tab (e.g., transformed Best Buy URLs)
const tabTrackUrls = new Map<number, string>()

// Store inventory state per tab so we can restore the correct icon on tab switch
const tabInventoryStates = new Map<number, InventoryStateNormalized>()

// Open the side panel on action click in browsers that support it,
// otherwise fall back to opening a new tab.
if (typeof chrome !== 'undefined' && chrome.sidePanel != null) {
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(console.error)
} else {
  browser.action.onClicked.addListener(tab => {
    const trackUrl = tab.id !== undefined ? tabTrackUrls.get(tab.id) : undefined
    const urlToTrack = trackUrl ?? tab.url
    const url =
      urlToTrack !== undefined && urlToTrack !== ''
        ? `https://isinstock.com/track?url=${encodeURIComponent(urlToTrack)}`
        : 'https://isinstock.com'
    browser.tabs.create({url})
  })
}

const iconPaths = (state: string) =>
  Object.fromEntries([16, 24, 32, 48, 64, 128].map(s => [`${s}`, `/images/inventory-states/${state}/${s}.png`]))

const setIconForState = (state: InventoryStateNormalized, tabId?: number) => {
  const opts: browser.Action.SetIconDetailsType = (() => {
    switch (state) {
      case InventoryStateNormalized.Available:
        return {path: iconPaths('available')}
      case InventoryStateNormalized.Unavailable:
        return {path: iconPaths('unavailable')}
      default:
        return {path: iconPaths('unknown')}
    }
  })()

  if (tabId !== undefined) {
    opts.tabId = tabId
  }

  browser.action.setIcon(opts)
}

// Clean up stored URLs and inventory states when tabs are closed
browser.tabs.onRemoved.addListener(tabId => {
  tabTrackUrls.delete(tabId)
  tabInventoryStates.delete(tabId)
})

// Restore the correct icon when switching tabs
browser.tabs.onActivated.addListener(({tabId}) => {
  const state = tabInventoryStates.get(tabId)
  setIconForState(state ?? InventoryStateNormalized.Unknown, tabId)
})

// As browser navigation changes, inform the content script as a hook for certain retailers to perform custom querying.
const loadedTabs = new Map<number, boolean>()
browser.tabs.onUpdated.addListener(
  (tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab: browser.Tabs.Tab) => {
    // Only when the tab is fully loaded
    if (changeInfo.status === 'complete') {
      // Only send message if the tab has been loaded before
      if (loadedTabs.has(tabId)) {
        browser.tabs.sendMessage(tabId, {
          action: MessageAction.URLChanged,
          url: tab.url,
        })
      } else {
        loadedTabs.set(tabId, true)
      }
    }
  },
)

browser.runtime.onStartup.addListener(async () => {
  // onStartup cannot be tested with puppeteer so we skip it
  if (CI) {
    return
  }

  try {
    const token = await getBrowserExtensionInstallToken()
    if (token !== '') {
      await browserExtensionStartup(token)
    }
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) {
      console.debug('Browser extension install not found')
    } else {
      throw error
    }
  }
})

// Register the install
browser.runtime.onInstalled.addListener(async ({reason}) => {
  // onInstalled cannot be tested with puppeteer so we skip it
  if (CI) {
    return
  }

  try {
    const existingToken = await getBrowserExtensionInstallToken()
    if (existingToken !== '') {
      await updateBrowserExtensionInstall(existingToken, browser.runtime.getManifest().version, reason)
      return
    }
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) {
      console.debug('Browser extension install not found, creating new one')
    } else {
      throw error
    }
  }

  try {
    const manifest = browser.runtime.getManifest()
    const version = manifest.version
    const {token} = await createBrowserExtensionInstall(version)
    await setBrowserExtensionInstallToken(token)
  } catch (e) {
    console.debug('Error creating browser extension install', e)
  }
})

// Receives messages from content scripts
browser.runtime.onMessage.addListener((msg: unknown, sender: browser.Runtime.MessageSender) => {
  const message = msg as Message
  const {action} = message

  if (action === MessageAction.TrackUrl && 'url' in message) {
    // Store the modified URL for this tab
    const tabId = sender.tab?.id
    if (tabId !== undefined) {
      tabTrackUrls.set(tabId, message.url)
      console.debug('Stored track URL for tab', tabId, message.url)
    }
  } else if (action === MessageAction.InventoryState && 'value' in message) {
    const tabId = sender.tab?.id
    if (tabId !== undefined) {
      tabInventoryStates.set(tabId, message.value as InventoryStateNormalized)
    }
    setIconForState(message.value as InventoryStateNormalized, tabId)
  } else {
    console.log('Unknown action', action)
  }

  return Promise.resolve({
    processed: true,
  })
})
