import {StateUpdater, useCallback, useEffect, useState} from 'preact/hooks'
import fetchPoll from 'src/utils/fetchPoll'

import {NearbyInventoryProductRequest, NearbyInventoryResponse} from '../../../@types/api'
import {SkuImportResponse, SkuImportResponseFinished} from '../../../@types/sku-imports'

const ImportableSku = ({
  request,
  onImported,
}: {
  request: NearbyInventoryProductRequest
  onImported: StateUpdater<null | NearbyInventoryResponse>
}) => {
  const [skuImportUrl, setSkuImportUrl] = useState<string | null>(null)

  const importSku = useCallback(async () => {
    const response = await fetch(`${API_URL}/extension/skus/import`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (response.status === 201) {
      const json = (await response.json()) as SkuImportResponse

      setSkuImportUrl(json.url)
    } else {
      throw new Error(`Bad response status ${response.status}`)
    }
  }, [request])

  useEffect(() => {
    const fetchSkuImport = async () => {
      if (!skuImportUrl) {
        return
      }

      const response = await fetchPoll(skuImportUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
      const json = (await response.json()) as SkuImportResponseFinished

      const skuResponse = await fetch(json.skuUrl, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (skuResponse.ok) {
        const skuResponseJson = (await skuResponse.json()) as NearbyInventoryResponse
        onImported(skuResponseJson)
      } else {
        throw new Error('what!')
        // some error state here
      }
    }
    fetchSkuImport()
  }, [skuImportUrl, onImported, request])

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
