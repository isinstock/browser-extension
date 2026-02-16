import {InventoryStateNormalized} from './inventory-states'

export enum MessageAction {
  InventoryState = 'inventory-state',
  Product = 'product',
  URLChanged = 'url-changed',
  TrackUrl = 'track-url',
  StartElementPicker = 'start-element-picker',
  ElementPickerStarted = 'element-picker-started',
  ElementPickerUpdate = 'element-picker-update',
  ElementPickerComplete = 'element-picker-complete',
  ElementPickerCancel = 'element-picker-cancel',
  ElementPickerError = 'element-picker-error',
  ElementPickerStateSync = 'element-picker-state-sync',
  ElementPickerCommand = 'element-picker-command',
  ElementPickerSidePanelReady = 'element-picker-side-panel-ready',
  ElementPickerSaved = 'element-picker-saved',
  Authentication = 'authentication',
  RevokeAuthentication = 'revoke-authentication',
}

export enum ElementPickerCommand {
  Remove = 'remove',
  ChangeExtract = 'change-extract',
  ChangeAttribute = 'change-attribute',
  Done = 'done',
  Cancel = 'cancel',
  SetMode = 'set-mode',
  RunAdvancedQuery = 'run-advanced-query',
  AddAdvancedSelector = 'add-advanced-selector',
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
  useSidePanel?: boolean
}

export interface ElementPickerStartedMessage extends ActionMessage {
  action: MessageAction.ElementPickerStarted
  sessionId: string
  mode: 'side_panel' | 'tab'
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

export interface PickerSelectionInfo {
  id: string
  cssSelector: string
  extract: string
  attributeName: string
  preview: string
  availableAttributes: string[]
}

export interface AdvancedPreviewItem {
  text: string
  tagName: string
}

export interface ElementPickerStateSyncMessage extends ActionMessage {
  action: MessageAction.ElementPickerStateSync
  sessionId: string
  selections: PickerSelectionInfo[]
  pickerMode: 'click' | 'advanced'
  advancedMatchCount: number
  advancedPreviews: AdvancedPreviewItem[]
  advancedInputValid: boolean
  advancedQuery: string
}

export interface ElementPickerCommandMessage extends ActionMessage {
  action: MessageAction.ElementPickerCommand
  sessionId: string
  command: ElementPickerCommand
  selectionId?: string
  extract?: string
  attributeName?: string
  mode?: 'click' | 'advanced'
  selector?: string
}

export interface ElementPickerSidePanelReadyMessage extends ActionMessage {
  action: MessageAction.ElementPickerSidePanelReady
}

export interface ElementPickerSavedMessage extends ActionMessage {
  action: MessageAction.ElementPickerSaved
  sessionId: string
  subscriptionUrl?: string
}

export interface AuthenticationMessage extends ActionMessage {
  action: MessageAction.Authentication
  token: string
}

export interface RevokeAuthenticationMessage extends ActionMessage {
  action: MessageAction.RevokeAuthentication
}

export type Message =
  | InventoryStateMessage
  | TrackUrlMessage
  | StartElementPickerMessage
  | ElementPickerStartedMessage
  | ElementPickerUpdateMessage
  | ElementPickerCompleteMessage
  | ElementPickerCancelMessage
  | ElementPickerErrorMessage
  | ElementPickerStateSyncMessage
  | ElementPickerCommandMessage
  | ElementPickerSidePanelReadyMessage
  | ElementPickerSavedMessage
  | AuthenticationMessage
  | RevokeAuthenticationMessage
