import { render } from "preact"
import { NearbyInventoryProductRequest } from "../@types/api"
import { InventoryState } from "../@types/inventory-states"

const IsInStockButton = () => {
  return <button type="primary">Primary Button</button>
}

interface InsertIsInStockButtonOptions {
  insertPosition?: InsertPosition
  inventoryState?: InventoryState
  request: NearbyInventoryProductRequest
}

export function insertIsInStockButton(
  element: HTMLElement,
  {
    insertPosition = 'afterend',
    inventoryState = InventoryState.Unknown,
    request,
  }: InsertIsInStockButtonOptions,
): void {
  render(IsInStockButton, element)
}
