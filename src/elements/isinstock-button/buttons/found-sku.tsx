import {useEffect, useState} from 'preact/hooks'

import {NearbyInventoryProductRequest, NearbyInventoryResponseFound} from '../../../@types/api'
import {InventoryStateNormalized} from '../../../@types/inventory-states'
import Sku from '../components/sku'

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
    if (!data) {
      return
    }

    const states = data.skus.flatMap(sku => {
      return sku.locations.flatMap(location => {
        return location.inventoryCheck?.state
      })
    })

    const availableStates = states.filter(state => state === InventoryStateNormalized.Available)
    if (availableStates.length > 0) {
      const pluralize = availableStates.length === 1 ? 'location' : 'locations'
      setInventoryState(InventoryStateNormalized.Available)
      setLabel(`In stock at ${availableStates.length} ${pluralize} near you`)
    } else {
      setInventoryState(InventoryStateNormalized.Unavailable)
      setLabel('Notify me')
    }
  }, [data])

  useEffect(() => {
    const tick = async () => {
      const response = await fetch(`${ISINSTOCK_URL}/extension/inventory/nearby`, {
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
      <summary>
        <img
          class="isinstock-logo"
          width="16"
          height="16"
          src={chrome.runtime.getURL(`images/inventory-states/${inventoryState}.svg`)}
        />
        <span class="isinstock-button-label">{label}</span>
      </summary>
      {data.skus.length > 0 && (
        <details-menu>
          <div class="select-menu">
            {data.skus.map(sku => (
              <Sku key={sku.sku} sku={sku} location={data.location} />
            ))}
            <a href={data.sku.url} class="select-menu-item">
              View on Is In Stock
            </a>
          </div>
        </details-menu>
      )}
    </details>
  )
}

export default FoundSku
