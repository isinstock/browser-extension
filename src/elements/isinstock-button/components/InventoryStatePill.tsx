import {InventoryStateNormalized} from '../../../@types/inventory-states'

type InventoryStatePillProps = {
  inventoryState: InventoryStateNormalized
}

const InventoryStatePill = ({inventoryState}: InventoryStatePillProps) => {
  if (inventoryState === InventoryStateNormalized.Available) {
    return <span class="px-2 inline-flex leading-5 rounded-full bg-green-100 text-green-800">In Stock</span>
  }

  return <span class="px-2 inline-flex leading-5 rounded-full bg-red-100 text-red-800">Out of Stock</span>
}

export default InventoryStatePill
