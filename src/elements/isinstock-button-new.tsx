import {render} from 'preact'
import {useMemo} from 'preact/hooks'
import {NearbyInventoryProductRequest} from '../@types/api'
import {InventoryState} from '../@types/inventory-states'

type IsInStockButtonProps = {
  request: NearbyInventoryProductRequest
}

const IsInStockButton = ({request}: IsInStockButtonProps) => {
  const results = useMemo(() => {
    fetch('http://localhost:3000/extension/inventory/nearby', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
    })
  }, [request])

  return (
    <details>
      <summary>
        <img
          class="isinstock-logo"
          width="16"
          height="16"
          src={chrome.runtime.getURL('images/inventory-states/available/128.png')}
        />
        <span class="isinstock-button-label">Checking nearby stores…</span>
      </summary>
      <details-menu>Hello world!</details-menu>
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
