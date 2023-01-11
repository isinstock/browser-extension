import {ItemAvailability, OfferItemCondition, Product, Offer} from './@types/linked-data'
import {InventoryState} from './@types/inventory-states'
import {MessageAction} from './@types/messages'

// To fire a message to detect for product on page
chrome.tabs.onActivated.addListener(activeInfo => {
  console.log(activeInfo)
})

// As browser navigation changes, inform the content script as a hook for certain retailers to perform custom querying.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log(tabId, changeInfo, tab)
  if (changeInfo.status == 'complete') {
    chrome.tabs.sendMessage(tabId, {
      action: MessageAction.URLChanged,
      url: tab.url,
    })
  }
})

// Receives messages from content scripts
chrome.runtime.onMessage.addListener(({action, value}, sender, sendResponse) => {
  if (action === MessageAction.InventoryState) {
    switch (value as InventoryState) {
      case InventoryState.Available:
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

      case InventoryState.Unavailable:
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
        console.log('setIcon(default)')
        chrome.action.setIcon({
          path: {
            '16': '/images/default/16.png',
            '24': '/images/default/24.png',
            '32': '/images/default/32.png',
            '48': '/images/default/48.png',
            '64': '/images/default/64.png',
            '128': '/images/default/128.png',
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
