import {InventoryStateNormalized} from './@types/inventory-states'
import {MessageAction} from './@types/messages'

// To fire a message to detect for product on page
chrome.tabs.onActivated.addListener(activeInfo => {
  console.log(activeInfo)
})

// chrome.action.onClicked.addListener(tab => {
//   chrome.tabs.query({windowType: 'normal', url: 'https://isinstock.com'}, tabs => {
//     if (tabs.length > 0 && tabs[0].id !== undefined) {
//       chrome.tabs.update(tabs[0].id, {active: true})
//     } else {
//       chrome.tabs.create({url: 'https://isinstock.com'})
//     }
//   })
// })

// chrome.storage.onChanged.addListener((changes, namespace) => {
//   console.log('chrome.storage.onChanged', changes, namespace)
// })

// As browser navigation changes, inform the content script as a hook for certain retailers to perform custom querying.
const loadedTabs = new Map<number, boolean>()
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only when the tab is fully loaded
  if (changeInfo.status === 'complete') {
    // Only send message if the tab has been loaded before
    if (loadedTabs.has(tabId)) {
      chrome.tabs.sendMessage(tabId, {
        action: MessageAction.URLChanged,
        url: tab.url,
      })
    } else {
      loadedTabs.set(tabId, true)
    }
  }
})

// Receives messages from content scripts
chrome.runtime.onMessage.addListener(({action, value}, sender, sendResponse) => {
  if (action === MessageAction.InventoryState) {
    switch (value as InventoryStateNormalized) {
      case InventoryStateNormalized.Available:
        chrome.action.setIcon({
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
        chrome.action.setIcon({
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
        chrome.action.setIcon({
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
