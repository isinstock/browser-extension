import {
  isOnlineSkuLocation,
  NearbyInventoryResponseSku,
  NearbyInventoryResponseSkuLocation,
  NearbyInventoryResponseSkuLocationOnline,
  NearbyInventoryResponseSkuLocationPhysical,
} from '../../../@types/api'
import {Coordinate} from '../../../@types/locations'
import {haversineLabel} from '../../../utils/haversine'
import InventoryStateBadge from './inventory-state-badge'

const SkuLocation = ({
  sku,
  skuLocation,
  centerCoordinate,
}: {
  sku: NearbyInventoryResponseSku
  skuLocation: NearbyInventoryResponseSkuLocation
  centerCoordinate?: Coordinate
}) => {
  if (isOnlineSkuLocation(skuLocation)) {
    return <SkuLocationOnline sku={sku} skuLocation={skuLocation} />
  }
  return <SkuLocationPhysical centerCoordinate={centerCoordinate} sku={sku} skuLocation={skuLocation} />
}

export default SkuLocation

const SkuLocationOnline = ({
  sku,
  skuLocation,
}: {
  sku: NearbyInventoryResponseSku
  skuLocation: NearbyInventoryResponseSkuLocationOnline
}) => {
  return (
    <div class="flex w-full items-center border-t border-gray-300 px-2">
      <div class="py-2 pl-2 align-middle text-sm text-gray-400 sm:pl-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
      </div>
      <div class="w-full whitespace-nowrap p-2 text-sm text-gray-900">
        <div class="flex items-center space-x-2">
          <span class="font-medium">
            <span class="hidden sm:inline">{sku.retailer.name}</span> Online
          </span>
        </div>
      </div>
      <div class="whitespace-nowrap p-2 align-middle text-xs text-gray-500">
        <div class="flex items-center space-x-2 sm:space-x-4">{/* <div class="flex space-x-2">As of …</div> */}</div>
      </div>
      <div class="whitespace-nowrap py-2 pr-2 text-right text-xs font-semibold sm:pr-0">
        {skuLocation.inventoryCheck?.state && <InventoryStateBadge inventoryState={skuLocation.inventoryCheck.state} />}
      </div>
    </div>
  )
}

const SkuLocationPhysical = ({
  sku,
  skuLocation,
  centerCoordinate,
}: {
  sku: NearbyInventoryResponseSku
  skuLocation: NearbyInventoryResponseSkuLocationPhysical
  centerCoordinate?: Coordinate
}) => {
  return (
    <div class="flex w-full items-center border-t border-gray-300 px-2">
      <div class="py-2 pl-2 align-middle text-sm text-gray-400 sm:pl-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
      <div class="w-full whitespace-nowrap p-2 text-sm text-gray-900">
        <div class="flex items-center space-x-2">
          <span class="font-medium">
            <span class="hidden sm:inline">{sku.retailer.name}</span> {skuLocation.name}
          </span>

          {/* This should be its own component */}
          <span class="text-xs text-gray-600">
            {centerCoordinate && <LocationDistance center={centerCoordinate} location={skuLocation.coordinate} />}
            <span class="hidden sm:inline-block">&bull; {skuLocation.address}</span>
          </span>
        </div>
      </div>
      <div class="whitespace-nowrap p-2 align-middle text-xs text-gray-500">
        <div class="flex items-center space-x-2 sm:space-x-4">{/* <div class="flex space-x-2">As of …</div> */}</div>
      </div>
      <div class="whitespace-nowrap py-2 pr-2 text-right text-xs font-semibold sm:pr-0">
        {skuLocation.inventoryCheck?.state && <InventoryStateBadge inventoryState={skuLocation.inventoryCheck.state} />}
      </div>
    </div>
  )
}

const LocationDistance = ({center, location}: {center: Coordinate; location: Coordinate}) => {
  const distance = haversineLabel({
    center,
    location,
  })

  return <span>{distance}</span>
}
