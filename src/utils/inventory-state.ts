import {InventoryStateNormalized} from '../@types/inventory-states'
import {Product} from '../@types/linked-data'
import {MessageAction} from '../@types/messages'
import {findOffer, isInStock, isNewCondition} from './helpers'

export const calculateInventoryState = (product: Product): InventoryStateNormalized => {
  console.log('Found product', product)

  const offer = findOffer(product)
  if (offer) {
    if (isNewCondition(offer) && isInStock(offer)) {
      return InventoryStateNormalized.Available
    }
    return InventoryStateNormalized.Unavailable
  }
  return InventoryStateNormalized.Unknown
}

export const broadcastInventoryState = (inventoryState: InventoryStateNormalized) => {
  chrome.runtime.sendMessage({
    action: MessageAction.InventoryState,
    value: inventoryState,
  })
}
