import browser from 'webextension-polyfill'

import {InventoryStateNormalized} from './@types/inventory-states'
import {Message, MessageAction} from './@types/messages'
import {
  browserExtensionStartup,
  createBrowserExtensionInstall,
  updateBrowserExtensionInstall,
} from './api/browser-extension-install'
import {getBrowserExtensionInstallToken, setBrowserExtensionInstallToken} from './utils/browser-extension-install-token'
import fetchApi from './utils/fetch-api'
import {FetchError} from './utils/fetch-error'

// Store modified URLs per tab (e.g., transformed Best Buy URLs)
const tabTrackUrls = new Map<number, string>()

// Store inventory state per tab so we can restore the correct icon on tab switch
const tabInventoryStates = new Map<number, InventoryStateNormalized>()

// Store picker sessions: sessionId -> session info
const pickerSessions = new Map<
  string,
  {
    originTabId?: number
    targetTabId: number
    url: string
  }
>()

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

// Clean up stored URLs, inventory states, and picker sessions when tabs are closed
browser.tabs.onRemoved.addListener(tabId => {
  tabTrackUrls.delete(tabId)
  tabInventoryStates.delete(tabId)

  // Check if the removed tab is a picker target tab and notify origin
  for (const [sid, session] of pickerSessions) {
    if (session.targetTabId === tabId) {
      if (session.originTabId !== undefined) {
        browser.tabs
          .sendMessage(session.originTabId, {
            action: MessageAction.ElementPickerCancel,
            sessionId: sid,
          })
          .catch(() => {})
      }
      pickerSessions.delete(sid)
    }
  }
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
        browser.tabs
          .sendMessage(tabId, {
            action: MessageAction.URLChanged,
            url: tab.url,
          })
          .catch(() => {})
      } else {
        loadedTabs.set(tabId, true)
      }
    }
  },
)

async function injectElementPicker(tabId: number, url: string, originTabId?: number, existingSessionId?: string) {
  const sid = existingSessionId ?? crypto.randomUUID()
  console.debug('[isinstock-bg] Injecting element picker into tab:', tabId, 'session:', sid, 'origin:', originTabId)
  pickerSessions.set(sid, {originTabId, targetTabId: tabId, url})

  await browser.scripting.executeScript({
    target: {tabId},
    files: ['content_scripts/element_picker.js'],
  })

  await browser.tabs.sendMessage(tabId, {
    action: MessageAction.StartElementPicker,
    sessionId: sid,
    url,
  })
}

// Context menu click handler
browser.contextMenus.onClicked.addListener((info, tab) => {
  console.debug('[isinstock-bg] Context menu clicked:', info.menuItemId, 'tab:', tab?.id, tab?.url)
  if (info.menuItemId === 'track-elements' && tab?.id) {
    injectElementPicker(tab.id, tab.url ?? '')
  }
})

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

  // Register context menu
  browser.contextMenus.create({
    id: 'track-elements',
    title: 'Track changes on this page',
    contexts: ['page'],
  })

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

  console.debug('[isinstock-bg] Message received:', action, 'from tab:', sender.tab?.id, sender.tab?.url)

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
  } else if (action === MessageAction.StartElementPicker && 'url' in message && 'sessionId' in message) {
    // From bridge: open the target URL in a new tab and inject the picker
    const startMsg = message as {url: string; sessionId: string}
    const originTabId = sender.tab?.id

    return (async () => {
      try {
        const resp = await fetchApi('/api/custom-tracking/validate', 'POST', JSON.stringify({url: startMsg.url}))
        if (!resp.ok) {
          if (originTabId !== undefined) {
            browser.tabs
              .sendMessage(originTabId, {
                action: MessageAction.ElementPickerCancel,
                sessionId: startMsg.sessionId,
                error: 'URL validation failed',
              })
              .catch(() => {})
          }
          return {processed: true}
        }

        const tab = await browser.tabs.create({url: startMsg.url, active: true})
        if (!tab.id) return {processed: true}

        // Wait for tab to finish loading
        await new Promise<void>(resolve => {
          const listener = (tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
              browser.tabs.onUpdated.removeListener(listener)
              resolve()
            }
          }
          browser.tabs.onUpdated.addListener(listener)
        })

        await injectElementPicker(tab.id, startMsg.url, originTabId, startMsg.sessionId)
      } catch (e) {
        console.debug('Error starting element picker from bridge', e)
        if (originTabId !== undefined) {
          browser.tabs
            .sendMessage(originTabId, {
              action: MessageAction.ElementPickerCancel,
              sessionId: startMsg.sessionId,
              error: 'Failed to start element picker',
            })
            .catch(() => {})
        }
      }
      return {processed: true}
    })()
  } else if (action === MessageAction.ElementPickerUpdate && 'sessionId' in message) {
    const updateMsg = message as {sessionId: string; selectors: unknown[]}
    const session = pickerSessions.get(updateMsg.sessionId)
    if (session?.originTabId !== undefined) {
      browser.tabs.sendMessage(session.originTabId, message).catch(() => {})
    }
  } else if (action === MessageAction.ElementPickerComplete && 'sessionId' in message) {
    const completeMsg = message as {sessionId: string; selectors: unknown[]}
    const session = pickerSessions.get(completeMsg.sessionId)

    if (session) {
      if (session.originTabId !== undefined) {
        // Flow B: forward to bridge and close target tab
        browser.tabs.sendMessage(session.originTabId, message).catch(() => {})
        browser.tabs.remove(session.targetTabId).catch(() => {})
        pickerSessions.delete(completeMsg.sessionId)
      } else {
        // Flow A: POST to API and open subscription URL
        ;(async () => {
          try {
            const resp = await fetchApi(
              '/api/custom-tracking',
              'POST',
              JSON.stringify({
                url: session.url,
                content_selectors: completeMsg.selectors,
              }),
            )
            if (resp.ok) {
              const data = (await resp.json()) as {subscription_url: string}
              if (data.subscription_url) {
                browser.tabs.create({url: data.subscription_url})
              }
              pickerSessions.delete(completeMsg.sessionId)
            } else {
              const errorMsg =
                resp.status === 401
                  ? 'You need to sign in to Is In Stock to use custom tracking.'
                  : `Failed to create tracking (${resp.status}).`
              browser.tabs
                .sendMessage(session.targetTabId, {
                  action: MessageAction.ElementPickerError,
                  sessionId: completeMsg.sessionId,
                  error: errorMsg,
                })
                .catch(() => {})
            }
          } catch (e) {
            browser.tabs
              .sendMessage(session.targetTabId, {
                action: MessageAction.ElementPickerError,
                sessionId: completeMsg.sessionId,
                error: 'Failed to connect to Is In Stock.',
              })
              .catch(() => {})
          }
        })()
      }
    }
  } else if (action === MessageAction.ElementPickerCancel && 'sessionId' in message) {
    const cancelMsg = message as {sessionId: string}
    const session = pickerSessions.get(cancelMsg.sessionId)
    if (session?.originTabId !== undefined) {
      browser.tabs.sendMessage(session.originTabId, message).catch(() => {})
    }
    pickerSessions.delete(cancelMsg.sessionId)
  } else {
    console.log('Unknown action', action)
  }

  return Promise.resolve({
    processed: true,
  })
})
