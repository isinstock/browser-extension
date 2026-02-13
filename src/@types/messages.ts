import {InventoryStateNormalized} from './inventory-states'

export enum MessageAction {
  InventoryState = 'inventory-state',
  Product = 'product',
  URLChanged = 'url-changed',
  TrackUrl = 'track-url',
  StartElementPicker = 'start-element-picker',
  ElementPickerUpdate = 'element-picker-update',
  ElementPickerComplete = 'element-picker-complete',
  ElementPickerCancel = 'element-picker-cancel',
  ElementPickerError = 'element-picker-error',
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

export interface SelectorEntry {
  label: string
  cssSelector: string
  extract: string
  attributeName: string
  preview: string
}

export interface StartElementPickerMessage extends ActionMessage {
  action: MessageAction.StartElementPicker
  url: string
  sessionId: string
}

export interface ElementPickerUpdateMessage extends ActionMessage {
  action: MessageAction.ElementPickerUpdate
  sessionId: string
  selectors: SelectorEntry[]
}

export interface ElementPickerCompleteMessage extends ActionMessage {
  action: MessageAction.ElementPickerComplete
  sessionId: string
  selectors: SelectorEntry[]
}

export interface ElementPickerCancelMessage extends ActionMessage {
  action: MessageAction.ElementPickerCancel
  sessionId: string
}

export interface ElementPickerErrorMessage extends ActionMessage {
  action: MessageAction.ElementPickerError
  sessionId: string
  error: string
}

export type Message =
  | InventoryStateMessage
  | TrackUrlMessage
  | StartElementPickerMessage
  | ElementPickerUpdateMessage
  | ElementPickerCompleteMessage
  | ElementPickerCancelMessage
  | ElementPickerErrorMessage
