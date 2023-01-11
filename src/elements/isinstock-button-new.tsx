import {render} from 'preact'
import {useEffect, useState} from 'preact/hooks'
import {
  NearbyInventoryProductRequest,
  NearbyInventoryResponse,
  NearbyInventoryResponseSkuLocation,
  NearbyInventoryResponseSkuLocationLocation,
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

type SkuProps = {
  sku: NearbyInventoryResponseSkuLocation
}

const Sku = ({sku}: SkuProps) => {
  return (
    <div>
      <SkuHeader sku={sku} />
    </div>
  )
}

const SkuHeader = ({sku}: SkuProps) => {
  const states = sku.locations.flatMap(location => location.inventoryCheck?.state ?? [])
  const availableStates = states.filter(state => state === InventoryState.Available)
  const link = availableStates.length > 0 ? <BuyNowLink href={sku.url} /> : <ViewProductLink href={sku.url} />

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
        <div class="font-medium">$129.99</div>
        <div class="text-xs">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            $70 off
          </span>
          was $199.99
        </div>
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
      const response = await fetch('http://localhost:3000/extension/inventory/nearby', {
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
      setLabel(`In stock at ${availableStates.length} locations near you`)
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
            <Sku sku={sku} />
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
