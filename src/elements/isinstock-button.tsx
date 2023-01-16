import {render} from 'preact'
import {useEffect, useState} from 'preact/hooks'

import {
  isFoundNearbyInventoryResponse,
  isImportableNearbyInventoryResponse,
  NearbyInventoryProductRequest,
  NearbyInventoryResponse,
} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {UserProvider} from '../contexts/user-context'
import {useAuth} from '../hooks'
import fetchApi from '../utils/fetch-api'
import FoundSku from './isinstock-button/buttons/found-sku'
import ImportableSku from './isinstock-button/buttons/importable-sku'
import UnsupportedSku from './isinstock-button/buttons/unsupported-sku'

type IsInStockButtonProps = {
  request: NearbyInventoryProductRequest
}
const IsInStockButton = ({request}: IsInStockButtonProps) => {
  const [data, setData] = useState<null | NearbyInventoryResponse>(null)
  const {accessToken} = useAuth()

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetchApi('/extension/inventory/nearby', 'POST', JSON.stringify(request))

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
    // Can we always just rely on sending original request?
    return <FoundSku data={data} request={request} />
  } else if (isImportableNearbyInventoryResponse(data)) {
    return <ImportableSku request={request} onImported={setData} />
  }
  return <UnsupportedSku />
}

interface InsertIsInStockButtonOptions {
  insertPosition?: InsertPosition
  inventoryState?: InventoryStateNormalized
  request: NearbyInventoryProductRequest
}

// Can we cache buttons that are created based on URL or some other unique key?
const buttons = new WeakMap()

export const insertIsInStockButton = (
  element: HTMLElement,
  {
    insertPosition = 'afterend',
    inventoryState = InventoryStateNormalized.Unknown,
    request,
  }: InsertIsInStockButtonOptions,
): HTMLElement => {
  let wrapper = document.querySelector<HTMLElement>('#isinstock-button')
  let shadowRoot = wrapper?.shadowRoot
  const app = (
    <UserProvider>
      <IsInStockButton request={request} />
    </UserProvider>
  )
  if (wrapper) {
    shadowRoot = wrapper.shadowRoot as ShadowRoot
    render(app, shadowRoot)
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

    render(app, shadowRoot)
  }

  return wrapper
}
