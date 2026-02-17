import browser from 'webextension-polyfill'

import {InventoryStateNormalized} from './@types/inventory-states'
import {captureException, initSentry} from './utils/sentry'

initSentry('background')
import {
  AuthenticationMessage,
  ContextMenuItem,
  Message,
  MessageAction,
  RevokeAuthenticationMessage,
} from './@types/messages'
import type {PageValidationFailedMessage} from './@types/messages'
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

async function injectElementPicker(
  tabId: number,
  url: string,
  originTabId?: number,
  existingSessionId?: string,
  title?: string,
) {
  const sid = existingSessionId ?? crypto.randomUUID()
  console.debug('[isinstock-bg] Injecting element picker into tab:', tabId, 'session:', sid, 'origin:', originTabId)
  pickerSessions.set(sid, {originTabId, targetTabId: tabId, url})

  // Check if the picker script is already loaded in this tab to avoid
  // re-injecting and re-creating all the DOM elements / listeners.
  const results = await browser.scripting.executeScript({
    target: {tabId},
    func: () => (window as any).__isinstockPickerLoaded === true,
  })
  const alreadyLoaded = results[0]?.result === true

  if (!alreadyLoaded) {
    await browser.scripting.executeScript({
      target: {tabId},
      files: ['content_scripts/element_picker.js'],
    })
  }

  // Send StartElementPicker immediately — the content script shows a spinner
  await browser.tabs.sendMessage(tabId, {
    action: MessageAction.StartElementPicker,
    sessionId: sid,
    url,
  })

  if (originTabId !== undefined) {
    browser.tabs
      .sendMessage(originTabId, {
        action: MessageAction.ElementPickerStarted,
        sessionId: sid,
      })
      .catch(() => {})
  }

  // Validate async — send result to content script
  const pageTitle =
    title ??
    (await browser.tabs
      .get(tabId)
      .then(t => t.title)
      .catch(() => undefined))
  const result = await validatePage(url, pageTitle)

  if (result.accessible) {
    browser.tabs.sendMessage(tabId, {action: MessageAction.PageValidationPassed, sessionId: sid}).catch(() => {})
  } else {
    const failMsg = validationFailedMessage(result)
    browser.tabs.sendMessage(tabId, failMsg).catch(() => {})
    if (originTabId !== undefined) {
      browser.tabs
        .sendMessage(originTabId, {
          action: MessageAction.ElementPickerCancel,
          sessionId: sid,
          error: failMsg.message,
        })
        .catch(() => {})
    }
  }
}

interface ValidateResult {
  accessible: boolean
  url?: string
  redirected?: boolean
  title_mismatch?: boolean
  server_title?: string
  error?: string
  message?: string
}

async function validatePage(url: string, title?: string): Promise<ValidateResult> {
  try {
    const body: Record<string, string> = {url}
    if (title) body.title = title
    const resp = await fetchApi('/api/custom-tracking/validate', 'POST', JSON.stringify(body))
    return (await resp.json()) as ValidateResult
  } catch {
    return {accessible: false, error: 'unreachable', message: 'Failed to connect to Is In Stock.'}
  }
}

function validationFailedMessage(result: ValidateResult): PageValidationFailedMessage {
  if (result.error === 'unreachable') {
    return {
      action: MessageAction.PageValidationFailed,
      reason: 'unreachable',
      message: result.message || 'This page could not be reached by our server.',
    }
  }
  if (result.redirected) {
    return {
      action: MessageAction.PageValidationFailed,
      reason: 'redirected',
      message: `This page redirects to a different site (${result.url}), so it can't be reliably tracked.`,
    }
  }
  if (result.title_mismatch) {
    return {
      action: MessageAction.PageValidationFailed,
      reason: 'title_mismatch',
      message: "This page appears to be blocked by bot protection, so it can't be reliably tracked.",
    }
  }
  return {
    action: MessageAction.PageValidationFailed,
    reason: 'unreachable',
    message: 'This page could not be validated for tracking.',
  }
}

// Register context menu at the top level so it survives service worker restarts.
// contextMenus.create with a duplicate id is a no-op (logs a harmless error).
browser.contextMenus.create({
  id: ContextMenuItem.TrackElements,
  title: 'Track changes on this page',
  contexts: ['page'],
})

// Context menu click handler
browser.contextMenus.onClicked.addListener((info, tab) => {
  console.debug('[isinstock-bg] Context menu clicked:', info.menuItemId, 'tab:', tab?.id, tab?.url)
  if (info.menuItemId === ContextMenuItem.TrackElements && tab?.id) {
    injectElementPicker(tab.id, tab.url ?? '', undefined, undefined, tab.title)
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
      captureException(error)
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
      captureException(error)
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
    captureException(e)
  }
})

// Receives authentication messages from isinstock.com pages via externally_connectable.
// The web page sends chrome.runtime.sendMessage(extensionId, { action, token })
// which Chrome routes here. Origin is enforced by the externally_connectable manifest key.
chrome.runtime.onMessageExternal.addListener(
  (
    message: AuthenticationMessage | RevokeAuthenticationMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse,
  ) => {
    if (message.action === MessageAction.Authentication && message.token) {
      chrome.storage.local.set({accessToken: message.token})
      sendResponse({success: true})
    } else if (message.action === MessageAction.RevokeAuthentication) {
      chrome.storage.local.remove('accessToken')
      sendResponse({success: true})
    }
  },
)

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

        // Inject picker — validation happens inside injectElementPicker.
        // If validation fails, injectElementPicker sends ElementPickerCancel
        // back to the origin tab.
        await injectElementPicker(tab.id, startMsg.url, originTabId, startMsg.sessionId)
      } catch (e) {
        console.debug('Error starting element picker from bridge', e)
        captureException(e)
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
        // Bridge flow: forward to origin tab, close target tab, switch back
        browser.tabs.sendMessage(session.originTabId, message).catch(() => {})
        browser.tabs.remove(session.targetTabId).catch(() => {})
        browser.tabs.update(session.originTabId, {active: true}).catch(() => {})
        pickerSessions.delete(completeMsg.sessionId)
      } else {
        // Context menu / side panel "Track new" flow: POST to API, notify content script
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
              browser.tabs
                .sendMessage(session.targetTabId, {
                  action: MessageAction.ElementPickerSaved,
                  sessionId: completeMsg.sessionId,
                  subscriptionUrl: data.subscription_url,
                })
                .catch(() => {})
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
            captureException(e)
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
    if (session) {
      if (session.originTabId !== undefined) {
        browser.tabs.sendMessage(session.originTabId, message).catch(() => {})
      }
    }
    pickerSessions.delete(cancelMsg.sessionId)
  } else if (action === MessageAction.TrackCurrentPage) {
    // From side panel "Track new" button: inject picker into the active tab
    return (async () => {
      try {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true})
        if (tab?.id) {
          await injectElementPicker(tab.id, tab.url ?? '', undefined, undefined, tab.title)
        }
      } catch (e) {
        console.debug('[isinstock-bg] Error starting picker from side panel', e)
        captureException(e)
      }
      return {processed: true}
    })()
  } else {
    console.log('Unknown action', action)
  }

  return Promise.resolve({
    processed: true,
  })
})
