import {render} from 'preact'
import {useEffect, useState} from 'preact/hooks'
import {Coordinate, LocationStyleNormalized} from 'src/@types/locations'
import {haversineLabel} from 'src/utils/haversine'
import {
  NearbyInventoryProductRequest,
  NearbyInventoryResponse,
  NearbyInventoryResponseSkuLocation,
  NearbyInventoryResponseSku,
  NearbyInventoryResponseSkuLocationPhysical,
  isOnlineSkuLocation,
  NearbyInventoryResponseSkuLocationOnline,
  NearbyInventoryResponseLocation,
} from '../@types/api'
import {InventoryState} from '../@types/inventory-states'

const BuyNowLink = ({href}: {href: string}) => {
  return (
    <a class="inventory-button inventory-button-available" href={href}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="inventory-button-icon text-white-400"
      >
        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path>
      </svg>

      <span class="whitespace-nowrap">Buy Now</span>
    </a>
  )
}

const ViewProductLink = ({href}: {href: string}) => {
  return (
    <a
      class="inventory-button inventory-button-unavailable hidden"
      data-availability-toggle-target="unavailable"
      href={href}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="inventory-button-icon text-gray-400"
      >
        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path>
      </svg>
      <span class="whitespace-nowrap">View Product</span>
    </a>
  )
}

const SkuLocationOnline = ({
  sku,
  skuLocation,
}: {
  sku: NearbyInventoryResponseSku
  skuLocation: NearbyInventoryResponseSkuLocationOnline
}) => {
  return (
    <div class="flex w-full items-center border-t border-gray-300">
      <div class="py-2 pl-2 sm:pl-0 text-sm text-gray-400 align-middle">
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
      <div class="whitespace-nowrap px-2 py-2 text-sm text-gray-900 w-full">
        <div class="flex items-center space-x-2">
          <span class="font-medium">
            <span class="hidden sm:inline-block">{sku.retailer.name} </span>
            Online
          </span>
        </div>
      </div>
      <div class="whitespace-nowrap px-2 py-2 text-xs text-gray-500 align-middle">
        <div class="flex items-center space-x-2 sm:space-x-4">{/* <div class="flex space-x-2">As of …</div> */}</div>
      </div>
      <div class="whitespace-nowrap py-2 pr-2 sm:pr-0 text-xs font-semibold text-right">
        {skuLocation.inventoryCheck?.state}
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

const SkuLocationPhysical = ({
  sku,
  skuLocation,
  centerCoordinate,
}: {
  sku: NearbyInventoryResponseSku
  skuLocation: NearbyInventoryResponseSkuLocationPhysical
  centerCoordinate?: Coordinate
}) => {
  console.log(centerCoordinate, skuLocation.coordinate)
  return (
    <div class="flex w-full items-center border-t border-gray-300">
      <div class="py-2 pl-2 sm:pl-0 text-sm text-gray-400 align-middle">
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
      <div class="whitespace-nowrap px-2 py-2 text-sm text-gray-900 w-full">
        <div class="flex items-center space-x-2">
          <span class="font-medium">
            <span class="hidden sm:inline-block">{sku.retailer.name} </span>
            {skuLocation.name}
          </span>

          {/* This should be its own component */}
          <span class="text-gray-600 text-xs">
            {centerCoordinate && <LocationDistance center={centerCoordinate} location={skuLocation.coordinate} />}
            <span class="hidden sm:inline-block">&bull; {skuLocation.address}</span>
          </span>
        </div>
      </div>
      <div class="whitespace-nowrap px-2 py-2 text-xs text-gray-500 align-middle">
        <div class="flex items-center space-x-2 sm:space-x-4">{/* <div class="flex space-x-2">As of …</div> */}</div>
      </div>
      <div class="whitespace-nowrap py-2 pr-2 sm:pr-0 text-xs font-semibold text-right">
        {skuLocation.inventoryCheck?.state}
      </div>
    </div>
  )
}

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
  } else {
    return <SkuLocationPhysical centerCoordinate={centerCoordinate} sku={sku} skuLocation={skuLocation} />
  }
}

const SkuLocations = ({
  sku,
  location,
}: {
  sku: NearbyInventoryResponseSku
  location?: NearbyInventoryResponseLocation
}) => {
  return (
    <div class="sku-locations">
      {sku.locations.map(skuLocation => (
        <SkuLocation centerCoordinate={location?.coordinate} sku={sku} skuLocation={skuLocation} />
      ))}
    </div>
  )
}

type SkuProps = {
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

const SkuHeader = ({sku}: SkuProps) => {
  const states = sku.locations.flatMap(location => location.inventoryCheck?.state ?? [])
  const availableStates = states.filter(state => state === InventoryState.Available)
  const link =
    availableStates.length > 0 ? <BuyNowLink href={sku.productUrl} /> : <ViewProductLink href={sku.productUrl} />

  return (
    <div class="flex items-center space-x-2 py-2 text-gray-900">
      <div>
        <span class="inline-block align-middle w-6">
          <img class="max-w-6" src={sku.retailer.imageUrl} />
        </span>
      </div>
      <div class="w-full leading-3">
        <span class="text-lg font-semibold block">{sku.retailer.name}</span>
        <div class="space-x-2">
          {sku.model && (
            <span class="text-xs text-gray-500">
              Model
              <span class="font-medium text-gray-500">{sku.model}</span>
            </span>
          )}

          <span class="text-xs text-gray-500">
            SKU
            <span class="font-medium text-gray-500">{sku.sku}</span>
          </span>
        </div>
      </div>
      <div class="whitespace-nowrap">
        {sku.formattedSalePrice ? (
          <>
            <div class="font-medium">{sku.formattedSalePrice}</div>
            <div class="text-xs">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {sku.formattedDiscountPrice} off
              </span>
              was {sku.formattedPrice}
            </div>
          </>
        ) : (
          <span class="font-medium">{sku.formattedPrice}</span>
        )}
      </div>
      <div>{link}</div>
    </div>
  )
}

type IsInStockButtonProps = {
  request: NearbyInventoryProductRequest
}
const IsInStockButton = ({request}: IsInStockButtonProps) => {
  const [data, setData] = useState<null | NearbyInventoryResponse>(null)
  const [label, setLabel] = useState('Checking nearby stores…')

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch(`${API_URL}/extension/inventory/nearby`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      })

      console.log(response)

      if (response.ok) {
        const json = (await response.json()) as NearbyInventoryResponse
        setData(json)
      } else {
        // Set proper error state
        setLabel('Oh no')
      }
    }

    fetchData()
  }, [request])

  useEffect(() => {
    if (!data) {
      return
    }

    const states = data.skus.flatMap(sku => {
      return sku.locations.flatMap(location => {
        return location.inventoryCheck?.state
      })
    })

    const availableStates = states.filter(state => state === InventoryState.Available)
    if (availableStates.length > 0) {
      const pluralize = availableStates.length === 1 ? 'location' : 'locations'
      setLabel(`In stock at ${availableStates.length} ${pluralize} near you`)
    } else {
      setLabel('Notify me')
    }
  }, [data])

  return (
    <details>
      <summary>
        <img
          class="isinstock-logo"
          width="16"
          height="16"
          src={chrome.runtime.getURL('images/inventory-states/available.svg')}
        />
        <span class="isinstock-button-label">{label}</span>
      </summary>
      <details-menu>
        <div class="select-menu">
          {data?.skus.map(sku => (
            <Sku sku={sku} location={data.location} />
          ))}
        </div>
      </details-menu>
    </details>
  )
}

interface InsertIsInStockButtonOptions {
  insertPosition?: InsertPosition
  inventoryState?: InventoryState
  request: NearbyInventoryProductRequest
}

export function insertIsInStockButton(
  element: HTMLElement,
  {insertPosition = 'afterend', inventoryState = InventoryState.Unknown, request}: InsertIsInStockButtonOptions,
): HTMLElement {
  const wrapper = document.createElement('div')
  const shadowRoot = wrapper.attachShadow({mode: 'open'})

  render(<IsInStockButton request={request} />, shadowRoot)

  // Can we prevent any flashing?
  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = chrome.runtime.getURL('elements/isinstock-button/style.css')
  shadowRoot.appendChild(stylesheet)

  element.insertAdjacentElement(insertPosition, wrapper)

  return wrapper
}
