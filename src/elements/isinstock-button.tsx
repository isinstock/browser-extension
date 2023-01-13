import {render} from 'preact'
import {useCallback, useEffect, useState} from 'preact/hooks'
import {Coordinate, LocationStyleNormalized} from 'src/@types/locations'
import {haversineLabel} from 'src/utils/haversine'
import {
  NearbyInventoryResponseState,
  NearbyInventoryProductRequest,
  NearbyInventoryResponse,
  NearbyInventoryResponseSkuLocation,
  NearbyInventoryResponseSku,
  NearbyInventoryResponseSkuLocationPhysical,
  isOnlineSkuLocation,
  NearbyInventoryResponseSkuLocationOnline,
  NearbyInventoryResponseLocation,
  NearbyInventoryResponseFound,
  isFoundNearbyInventoryResponse,
  isImportableNearbyInventoryResponse,
  NearbyInventoryResponseImportable,
} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import FoundSku from './isinstock-button/buttons/FoundSku'
import ImportableSku from './isinstock-button/buttons/ImportableSku'
import UnsupportedSku from './isinstock-button/buttons/UnsupportedSku'
import InventoryStatePill from './isinstock-button/components/InventoryStatePill'
import RetailerProductLink from './isinstock-button/components/RetailerProductLink'

type IsInStockButtonProps = {
  request: NearbyInventoryProductRequest
}
const IsInStockButton = ({request}: IsInStockButtonProps) => {
  const [data, setData] = useState<null | NearbyInventoryResponse>(null)

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

      if (response.ok) {
        const json = (await response.json()) as NearbyInventoryResponse
        setData(json)
      } else {
        setData(null)
      }
    }

    fetchData()
  }, [request])

  if (!data) {
    return <></>
  }

  const {state} = data

  if (isFoundNearbyInventoryResponse(data)) {
    return <FoundSku data={data} />
  } else if (isImportableNearbyInventoryResponse(data)) {
    return <ImportableSku request={request} />
  } else {
    return <UnsupportedSku />
  }
}

interface InsertIsInStockButtonOptions {
  insertPosition?: InsertPosition
  inventoryState?: InventoryStateNormalized
  request: NearbyInventoryProductRequest
}

// Can we cache buttons that are created based on URL or some other unique key?
const buttons = new WeakMap()

export function insertIsInStockButton(
  element: HTMLElement,
  {
    insertPosition = 'afterend',
    inventoryState = InventoryStateNormalized.Unknown,
    request,
  }: InsertIsInStockButtonOptions,
): HTMLElement {
  let wrapper = document.querySelector<HTMLElement>('#isinstock-button')
  let shadowRoot = wrapper?.shadowRoot
  if (wrapper) {
    shadowRoot = wrapper.shadowRoot as ShadowRoot
    render(<IsInStockButton request={request} />, shadowRoot)
  } else {
    wrapper = document.createElement('div')
    wrapper.id = 'isinstock-button'
    shadowRoot = wrapper.attachShadow({mode: 'open'})

    // Can we prevent any flashing?
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = chrome.runtime.getURL('elements/isinstock-button/style.css')
    shadowRoot.appendChild(stylesheet)

    element.insertAdjacentElement(insertPosition, wrapper)

    render(<IsInStockButton request={request} />, shadowRoot)
  }

  return wrapper
}
