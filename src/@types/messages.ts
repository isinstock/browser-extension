import {InventoryStateNormalized} from './inventory-states'

export enum MessageAction {
  InventoryState = 'inventory-state',
  Product = 'product',
  URLChanged = 'url-changed',
  TrackUrl = 'track-url',
}

export interface ActionMessage {
  action: MessageAction
}

export interface InventoryStateMessage extends ActionMessage {
  value: InventoryStateNormalized
}

export interface TrackUrlMessage extends ActionMessage {
  action: MessageAction.TrackUrl
  url: string
}

export type Message = InventoryStateMessage | TrackUrlMessage
