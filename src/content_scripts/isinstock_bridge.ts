import browser from 'webextension-polyfill'
import {MessageAction} from '../@types/messages'

const hostname = window.location.hostname
if (hostname === 'isinstock.com' || hostname === 'isinstock.localhost') {
  console.debug('[isinstock-bridge] Bridge active on', window.location.href)

  // Signal that the extension is installed
  document.documentElement.dataset.isinstockExtension = 'true'

  // Listen for custom events from the isinstock.com page
  document.addEventListener('isinstock:start-picker', (event: Event) => {
    const detail = (event as CustomEvent).detail
    console.debug('[isinstock-bridge] Received start-picker event', detail)
    browser.runtime
      .sendMessage({
        action: MessageAction.StartElementPicker,
        url: detail.url,
        sessionId: detail.sessionId,
      })
      .catch(() => {
        document.documentElement.dataset.isinstockExtension = 'reloaded'
        document.dispatchEvent(
          new CustomEvent('isinstock:picker-error', {
            detail: {error: 'Extension was updated. Please refresh the page.'},
          }),
        )
      })
  })

  // Listen for messages from the background script and forward to the page
  browser.runtime.onMessage.addListener((msg: unknown) => {
    const message = msg as {action: string; [key: string]: unknown}

    if (message.action === MessageAction.ElementPickerStarted) {
      document.dispatchEvent(new CustomEvent('isinstock:picker-started', {detail: message}))
    } else if (message.action === MessageAction.ElementPickerUpdate) {
      document.dispatchEvent(new CustomEvent('isinstock:picker-update', {detail: message}))
    } else if (message.action === MessageAction.ElementPickerComplete) {
      document.dispatchEvent(new CustomEvent('isinstock:picker-complete', {detail: message}))
    } else if (message.action === MessageAction.ElementPickerCancel) {
      document.dispatchEvent(new CustomEvent('isinstock:picker-cancel', {detail: message}))
    } else if (message.action === MessageAction.ElementPickerError) {
      document.dispatchEvent(new CustomEvent('isinstock:picker-error', {detail: message}))
    }
  })
}
