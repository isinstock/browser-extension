import {InventoryStateNormalized} from './@types/inventory-states'
import {MessageAction} from './@types/messages'
import {extensionApi} from './utils/extension-api'

// To fire a message to detect for product on page
extensionApi.tabs.onActivated.addListener(activeInfo => {
  console.log(activeInfo)
})

// extensionApi.action.onClicked.addListener(tab => {
//   extensionApi.tabs.query({windowType: 'normal', url: 'https://isinstock.com'}, tabs => {
//     if (tabs.length > 0 && tabs[0].id !== undefined) {
//       extensionApi.tabs.update(tabs[0].id, {active: true})
//     } else {
//       extensionApi.tabs.create({url: 'https://isinstock.com'})
//     }
//   })
// })

// extensionApi.storage.onChanged.addListener((changes, namespace) => {
//   console.log('extensionApi.storage.onChanged', changes, namespace)
// })

// As browser navigation changes, inform the content script as a hook for certain retailers to perform custom querying.
const loadedTabs = new Map<number, boolean>()
extensionApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only when the tab is fully loaded
  if (changeInfo.status === 'complete') {
    // Only send message if the tab has been loaded before
    if (loadedTabs.has(tabId)) {
      extensionApi.tabs.sendMessage(tabId, {
        action: MessageAction.URLChanged,
        url: tab.url,
      })
    } else {
      loadedTabs.set(tabId, true)
    }
  }
})

// Receives messages from content scripts
extensionApi.runtime.onMessage.addListener(({action, value}, sender, sendResponse) => {
  if (action === MessageAction.InventoryState) {
    switch (value as InventoryStateNormalized) {
      case InventoryStateNormalized.Available:
        extensionApi.action.setIcon({
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
        extensionApi.action.setIcon({
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
        extensionApi.action.setIcon({
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
    console.log('Unknown action', action, 'with value', value)
  }

  sendResponse({
    processed: true,
  })
})
