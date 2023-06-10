export enum InventoryState {
  Available = 'available',
  LimitedAvailability = 'limited_availability',

  Unavailable = 'unavailable',
  ComingSoon = 'coming_soon',
  PreOrder = 'preorder',
  InsufficientInventory = 'insufficient_inventory',
  ShipsToStore = 'ships_to_store',
  Ineligible = 'ineligible',
  Error = 'error',
  InsufficientData = 'insufficient_data',
  TimedOut = 'timed_out',
  Unknown = 'unknown',
}

export enum InventoryStateNormalized {
  Available = 'available',
  Unavailable = 'unavailable',
  Unknown = 'unknown',
}
