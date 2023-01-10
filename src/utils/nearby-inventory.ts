import {NearbyInventoryRequestType} from '../@types/api'
import {InventoryState} from '../@types/inventory-states'
import {Product} from '../@types/linked-data'
import {MessageAction} from '../@types/messages'
import {insertWidget} from '../elements/widget'

export const requestFromProduct = (product: Product): NearbyInventoryRequestType => {
  return {
    search: {
      manufacture: product.brand?.name,
      name: product.name,
      sku: product.sku,
      model: product.model,
      url: product.url,
      description: product.description,
      upc: product.asin || product.gtin13,
    },
    context: {
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
    productSchema: product,
  }
}

export const findNearbyInventory = (request: NearbyInventoryRequestType, inventoryState?: InventoryState) => {
  chrome.runtime.sendMessage({
    action: MessageAction.Product,
    value: request,
  })

  fetch('https://www.isinstock.com/extension/inventory/nearby', {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/html',
    },
    body: JSON.stringify(request),
  })
    .then(response => response.text())
    .then(html => insertWidget(html))
}
