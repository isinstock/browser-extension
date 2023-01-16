import {InventoryStateNormalized} from '../../../@types/inventory-states'
import RetailerProductLink from './retailer-product-link'
import {SkuProps} from './Sku'

const SkuHeader = ({sku}: SkuProps) => {
  const states = sku.locations.flatMap(location => location.inventoryCheck?.state ?? [])
  const availableStates = states.filter(state => state === InventoryStateNormalized.Available)
  const inventoryStateNormalized =
    availableStates.length > 0 ? InventoryStateNormalized.Available : InventoryStateNormalized.Unavailable

  return (
    <div class="flex items-center space-x-2 p-2 text-gray-900">
      <div>
        <span class="inline-block w-6 align-middle">
          <img class="max-w-6" src={sku.retailer.imageUrl} />
        </span>
      </div>
      <div class="w-full leading-3">
        <span class="block text-lg font-semibold">{sku.retailer.name}</span>
        <div class="space-x-2">
          {sku.model && (
            <span class="text-xs text-gray-500">
              Model <span class="font-medium text-gray-500">{sku.model}</span>
            </span>
          )}
        </div>
      </div>
      <div class="whitespace-nowrap">
        {sku.formattedSalePrice ? (
          <>
            <div class="font-medium">{sku.formattedSalePrice}</div>
            <div class="text-xs">
              <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                {sku.formattedDiscountPrice} off
              </span>
              was {sku.formattedPrice}
            </div>
          </>
        ) : (
          <span class="font-medium">{sku.formattedPrice}</span>
        )}
      </div>
      <div>
        <RetailerProductLink inventoryState={inventoryStateNormalized} href={sku.productUrl} />
      </div>
    </div>
  )
}

export default SkuHeader
