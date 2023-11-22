import browser from 'webextension-polyfill'

import {InventoryStateNormalized} from '../@types/inventory-states'
import {MessageAction} from '../@types/messages'

const inStockAvailability = ['InStock', 'InStoreOnly', 'LimitedAvailability', 'OnlineOnly', 'PreSale', 'PreOrder']

export const isInStock = (itemAvailability: string): boolean => {
  return inStockAvailability.some(
    candidate => candidate.localeCompare(itemAvailability, undefined, {sensitivity: 'accent'}) === 0,
  )
}

export const broadcastInventoryState = (value: InventoryStateNormalized) => {
  browser.runtime.sendMessage({
    action: MessageAction.InventoryState,
    value,
  })
}
