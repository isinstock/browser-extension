import {NearbyInventoryResponseLocation, NearbyInventoryResponseSku} from '../../../@types/api'
import SkuHeader from './sku-header'
import SkuLocations from './sku-locations'

export type SkuProps = {
  sku: NearbyInventoryResponseSku
  location?: NearbyInventoryResponseLocation
}

const Sku = ({sku, location}: SkuProps) => {
  return (
    <div class="sku-wrapper">
      <SkuHeader sku={sku} />
      <SkuLocations sku={sku} location={location} />
    </div>
  )
}

export default Sku
