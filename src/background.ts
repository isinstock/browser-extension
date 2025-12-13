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

// Open isinstock.com when the extension icon is clicked
browser.action.onClicked.addListener(tab => {
  console.log(tab)
  // Use the modified URL if available, otherwise fall back to tab.url
  const trackUrl = tab.id !== undefined ? tabTrackUrls.get(tab.id) : undefined
  const urlToTrack = trackUrl ?? tab.url
  const url =
    urlToTrack !== undefined && urlToTrack !== ''
      ? `https://isinstock.com/track?url=${encodeURIComponent(urlToTrack)}`
      : 'https://isinstock.com'
  browser.tabs.create({url})
})

// Clean up stored URLs when tabs are closed
browser.tabs.onRemoved.addListener(tabId => {
  tabTrackUrls.delete(tabId)
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
browser.runtime.onMessage.addListener((message: Message, sender) => {
  const {action} = message

  if (action === MessageAction.TrackUrl && 'url' in message) {
    // Store the modified URL for this tab
    const tabId = sender.tab?.id
    if (tabId !== undefined) {
      tabTrackUrls.set(tabId, message.url)
      console.debug('Stored track URL for tab', tabId, message.url)
    }
  } else if (action === MessageAction.InventoryState && 'value' in message) {
    switch (message.value) {
      case InventoryStateNormalized.Available:
        browser.action.setIcon({
          path: {
            '16': '/images/inventory-states/available/16.png',
            '24': '/images/inventory-states/available/24.png',
            '32': '/images/inventory-states/available/32.png',
            '48': '/images/inventory-states/available/48.png',
            '64': '/images/inventory-states/available/64.png',
            '128': '/images/inventory-states/available/128.png',
          },
        })
        break

      case InventoryStateNormalized.Unavailable:
        browser.action.setIcon({
          path: {
            '16': '/images/inventory-states/unavailable/16.png',
            '24': '/images/inventory-states/unavailable/24.png',
            '32': '/images/inventory-states/unavailable/32.png',
            '48': '/images/inventory-states/unavailable/48.png',
            '64': '/images/inventory-states/unavailable/64.png',
            '128': '/images/inventory-states/unavailable/128.png',
          },
        })
        break

      default:
        browser.action.setIcon({
          path: {
            '16': '/images/inventory-states/unknown/16.png',
            '24': '/images/inventory-states/unknown/24.png',
            '32': '/images/inventory-states/unknown/32.png',
            '48': '/images/inventory-states/unknown/48.png',
            '64': '/images/inventory-states/unknown/64.png',
            '128': '/images/inventory-states/unknown/128.png',
          },
        })
        break
    }
  } else {
    console.log('Unknown action', action)
  }

  return Promise.resolve({
    processed: true,
  })
})
