import {InventoryStateNormalized} from '../../../@types/inventory-states'

type InventoryStateBadgeProps = {
  inventoryState: InventoryStateNormalized
}

const InventoryStateBadge = ({inventoryState}: InventoryStateBadgeProps) => {
  if (inventoryState === InventoryStateNormalized.Available) {
    return <span class="inline-flex rounded-full bg-green-100 px-2 leading-5 text-green-800">In Stock</span>
  }

  return <span class="inline-flex rounded-full bg-red-100 px-2 leading-5 text-red-800">Out of Stock</span>
}

export default InventoryStateBadge
