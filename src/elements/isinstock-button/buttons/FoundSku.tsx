import {useEffect, useState} from 'preact/hooks'
import {NearbyInventoryResponseFound} from 'src/@types/api'
import {InventoryStateNormalized} from 'src/@types/inventory-states'
import Sku from '../components/Sku'

const FoundSku = ({data}: {data: NearbyInventoryResponseFound}) => {
  const [label, setLabel] = useState('Checking nearby stores…')
  const [inventoryState, setInventoryState] = useState(InventoryStateNormalized.Unknown)
  const {sku, skus, location} = data

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
      {skus.length > 0 && (
        <details-menu>
          <div class="select-menu">
            {skus.map(sku => (
              <Sku sku={sku} location={location} />
            ))}
            <a href={sku.url} class="select-menu-item">
              View on Is In Stock
            </a>
          </div>
        </details-menu>
      )}
    </details>
  )
}

export default FoundSku
