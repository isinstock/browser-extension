import {useEffect, useState} from 'preact/hooks'

import {NearbyInventoryProductRequest, NearbyInventoryResponseFound} from '../../../@types/api'
import {InventoryStateNormalized} from '../../../@types/inventory-states'
import fetchApi from '../../../utils/fetch-api'
import Sku from '../components/sku'

const NoLocationsFound = () => {
  return (
    <div class="select-menu login-prompt">
      <div class="grow">
        <img class="mx-auto h-12 w-auto" src={chrome.runtime.getURL('images/logos/isinstock.svg')} />
        <h1 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Is In Stock</h1>
      </div>
      <div>
        <a
          href={`${ISINSTOCK_URL}`}
          target="_blank"
          rel="noreferrer"
          class="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Create Alert
        </a>
      </div>
    </div>
  )
}

const FoundSku = ({
  data: responseData,
  request,
}: {
  data: NearbyInventoryResponseFound
  request: NearbyInventoryProductRequest
}) => {
  const [data, setData] = useState<NearbyInventoryResponseFound>(responseData)
  const [label, setLabel] = useState('Checking nearby stores…')

  const [inventoryState, setInventoryState] = useState(InventoryStateNormalized.Unknown)

  useEffect(() => {
    const states = data.skus.flatMap(sku => {
      return sku.locations.flatMap(location => {
        return location.inventoryCheck?.state
      })
    })

    const availableStates = states.filter(state => state === InventoryStateNormalized.Available)
    if (availableStates.length > 0) {
      const pluralize = availableStates.length === 1 ? 'store' : 'stores'
      setInventoryState(InventoryStateNormalized.Available)

      if (data.location) {
        setLabel(`In stock at ${availableStates.length} ${pluralize} near ${data.location.name}`)
      } else {
        setLabel(`In stock at ${availableStates.length} ${pluralize} near you`)
      }
    } else {
      setInventoryState(InventoryStateNormalized.Unavailable)
      setLabel('Not in stock nearby or online')
    }
  }, [data])

  useEffect(() => {
    const tick = async () => {
      const response = await fetchApi('/api/inventory/nearby', 'POST', JSON.stringify(request))
      if (response.ok) {
        const json = (await response.json()) as NearbyInventoryResponseFound

        setData(json)
      }
    }

    // Refresh inventory every minute
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [request])

  return (
    <details>
      <summary class="isinstock-button">
        <img
          class="isinstock-logo"
          width="16"
          height="16"
          src={chrome.runtime.getURL(`images/inventory-states/${inventoryState}.svg`)}
        />
        <span>{label}</span>
      </summary>
      <details-menu>
        <div class="select-menu">
          <div class="overflow-y-scroll">
            {data.skus.length > 0 ? (
              data.skus.map(sku => <Sku key={sku.sku} sku={sku} location={data.location} />)
            ) : (
              <NoLocationsFound />
            )}
          </div>
          <a
            href={data.sku.url}
            target="_blank"
            class="border-t border-gray-300 bg-gray-50 p-2 text-center text-xs hover:bg-gray-100"
            rel="noreferrer"
          >
            View on Is In Stock <span aria-hidden="true"> &rarr;</span>
          </a>
        </div>
      </details-menu>
    </details>
  )
}

export default FoundSku
