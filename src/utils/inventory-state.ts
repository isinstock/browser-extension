import {ItemAvailability, Product} from '../@types/linked-data'
import {findOffer, isInStock, isNewCondition} from './helpers'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {MessageAction} from '../@types/messages'

export const calculateInventoryState = (product: Product): InventoryStateNormalized => {
  console.log('Found product', product)

  const offer = findOffer(product)
  if (offer) {
    if (isNewCondition(offer) && isInStock(offer)) {
      return InventoryStateNormalized.Available
    } else {
      return InventoryStateNormalized.Unavailable
    }
  } else {
    return InventoryStateNormalized.Unknown
  }
}

export const broadcastInventoryState = (inventoryState: InventoryStateNormalized) => {
  chrome.runtime.sendMessage({
    action: MessageAction.InventoryState,
    value: inventoryState,
  })
}
