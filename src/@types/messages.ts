import {InventoryStateNormalized} from './inventory-states'

export enum MessageAction {
  InventoryState = 'inventory-state',
  Product = 'product',
  URLChanged = 'url-changed',
}

export interface ActionMessage {
  action: MessageAction
}

export interface InventoryStateMessage extends ActionMessage {
  value: InventoryStateNormalized
}

export type Message = InventoryStateMessage
