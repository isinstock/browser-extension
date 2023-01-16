import {NearbyInventoryResponseLocation, NearbyInventoryResponseSku} from '../../../@types/api'
import {InventoryStateNormalized} from '../../../@types/inventory-states'
import SkuLocation from './sku-location'

const SkuLocations = ({
  sku,
  location,
}: {
  sku: NearbyInventoryResponseSku
  location?: NearbyInventoryResponseLocation
}) => {
  const availableSkuLocations = sku.locations.filter(
    skuLocation => skuLocation.inventoryCheck?.state === InventoryStateNormalized.Available,
  )

  if (availableSkuLocations.length > 0) {
    return (
      <div>
        {availableSkuLocations.map(skuLocation => (
          <SkuLocation
            key={skuLocation.locationUrl}
            centerCoordinate={location?.coordinate}
            sku={sku}
            skuLocation={skuLocation}
          />
        ))}
      </div>
    )
  }
  return (
    <div class="flex w-full items-center border-t border-gray-300 px-2">
      <div class="py-2 pl-2 align-middle text-sm text-gray-400 sm:pl-0">None Available</div>
    </div>
  )
}

export default SkuLocations
