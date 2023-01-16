import {StateUpdater, useCallback, useEffect, useState} from 'preact/hooks'

import {NearbyInventoryProductRequest, NearbyInventoryResponse} from '../../../@types/api'
import {SkuImportResponse, SkuImportResponseFinished} from '../../../@types/sku-imports'
import LoginLink from '../../../components/login-link'
import {useAuth} from '../../../hooks'
import fetchPoll from '../../../utils/fetchPoll'

const SelectMenu = ({request, onImported}: ImportableSkuProps) => {
  const {isLoggedIn} = useAuth()

  if (isLoggedIn) {
    return <LoggedInMenu request={request} onImported={onImported} />
  }

  return <LoggedOutMenu />
}

const LoggedInMenu = ({request, onImported}: ImportableSkuProps) => {
  const [skuImportUrl, setSkuImportUrl] = useState<string | null>(null)

  const importSku = useCallback(async () => {
    const response = await fetch(`${ISINSTOCK_URL}/extension/skus/import`, {
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
    <button type="button" onClick={importSku}>
      Import!
    </button>
  )
}

const LoggedOutMenu = () => {
  return <LoginLink />
}

type ImportableSkuProps = {
  request: NearbyInventoryProductRequest
  onImported: StateUpdater<null | NearbyInventoryResponse>
}

const ImportableSku = ({request, onImported}: ImportableSkuProps) => {
  return (
    <details>
      <summary>
        <img
          class="isinstock-logo"
          width="16"
          height="16"
          src={chrome.runtime.getURL(`images/inventory-states/unknown.svg`)}
        />
        <span>Track</span>
      </summary>
      <details-menu>
        <div class="select-menu">
          <SelectMenu request={request} onImported={onImported} />
        </div>
      </details-menu>
    </details>
  )
}

export default ImportableSku
