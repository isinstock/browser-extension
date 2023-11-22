import browser from 'webextension-polyfill'

import {InventoryStateNormalized} from '../@types/inventory-states'
import {Message, MessageAction} from '../@types/messages'

const inStockAvailability = ['InStock', 'InStoreOnly', 'LimitedAvailability', 'OnlineOnly', 'PreSale', 'PreOrder']

export const isInStock = (itemAvailability: string): boolean => {
  return inStockAvailability.some(
    candidate => candidate.localeCompare(itemAvailability, undefined, {sensitivity: 'accent'}) === 0,
  )
}

export const broadcastInventoryState = async (value: InventoryStateNormalized) => {
  const message: Message = {
    action: MessageAction.InventoryState,
    value,
  }

  browser.runtime.sendMessage(message)
}
