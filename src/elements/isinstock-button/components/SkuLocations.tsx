import {NearbyInventoryResponseLocation, NearbyInventoryResponseSku} from 'src/@types/api'
import {InventoryStateNormalized} from 'src/@types/inventory-states'
import SkuLocation from './SkuLocation'

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
      <div class="sku-locations">
        {availableSkuLocations.map(skuLocation => (
          <SkuLocation centerCoordinate={location?.coordinate} sku={sku} skuLocation={skuLocation} />
        ))}
      </div>
    )
  } else {
    return <div class="sku-locations">None available</div>
  }
}

export default SkuLocations
