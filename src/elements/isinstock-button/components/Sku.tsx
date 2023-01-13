import {NearbyInventoryResponseLocation, NearbyInventoryResponseSku} from 'src/@types/api'
import SkuHeader from './SkuHeader'
import SkuLocations from './SkuLocations'

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
