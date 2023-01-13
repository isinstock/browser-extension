import {useCallback} from 'preact/hooks'
import {NearbyInventoryProductRequest} from 'src/@types/api'

const ImportableSku = ({request}: {request: NearbyInventoryProductRequest}) => {
  const importSku = useCallback(async () => {
    console.log('importSku')
    const response = await fetch(`${API_URL}/extension/skus/import`, {
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
  }, [request])

  return (
    <details>
      <summary>
        <img
          class="isinstock-logo"
          width="16"
          height="16"
          src={chrome.runtime.getURL(`images/inventory-states/unknown.svg`)}
        />
        <span class="isinstock-button-label">Track</span>
      </summary>
      <details-menu>
        <div class="select-menu">
          <button type="button" onClick={importSku}>
            Import!
          </button>
        </div>
      </details-menu>
    </details>
  )
}

export default ImportableSku
