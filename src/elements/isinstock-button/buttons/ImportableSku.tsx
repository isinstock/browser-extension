import {StateUpdater, useCallback, useEffect, useState} from 'preact/hooks'
import {NearbyInventoryProductRequest, NearbyInventoryResponse} from 'src/@types/api'
import {SkuImportResponse, SkuImportState} from 'src/@types/sku-imports'

const fetchPoll = async (url: RequestInfo, options: RequestInit, pollInterval: number = 1000): Promise<Response> => {
  const poll = async (wait: number): Promise<Response> => {
    const request = new Request(url, options)
    const response = await fetch(request)
    const {status} = response
    if (status < 200 || status >= 300) {
      throw new Error(`Bad response status ${status}`)
    }

    if (response.redirected) {
      return response
    }

    const json = (await response.json()) as SkuImportResponse
    const {state} = json

    if (state === SkuImportState.Errored || state === SkuImportState.Finished) {
      return response
    }

    await new Promise(resolve => setTimeout(resolve, wait))
    return poll(wait)
  }
  return poll(pollInterval)
}

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
    } else if (response.redirected) {
      const skuResponse = await fetch(response.url, {
        method: 'get',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (skuResponse.ok) {
        const json = (await skuResponse.json()) as NearbyInventoryResponse
        onImported(json)
      } else {
        // some error state here
      }
    }
  }, [request, onImported])

  useEffect(() => {
    if (!skuImportUrl) {
      return
    }

    fetchPoll(skuImportUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
      .then(async response => {
        if (response.redirected) {
          const skuResponse = await fetch(response.url, {
            method: 'get',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(request),
          })

          if (skuResponse.ok) {
            const json = (await skuResponse.json()) as NearbyInventoryResponse
            onImported(json)
          } else {
            // some error state here
          }
        } else {
          console.log('skuImport response', response)
        }
      })
      .catch(error => {
        console.log(error)
      })
  }, [skuImportUrl])

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
