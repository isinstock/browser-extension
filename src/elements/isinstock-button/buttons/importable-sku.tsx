import {StateUpdater, useCallback, useEffect, useState} from 'preact/hooks'

import {NearbyInventoryProductRequest, NearbyInventoryResponse} from '../../../@types/api'
import {SkuImportResponse, SkuImportResponseFinished} from '../../../@types/sku-imports'
import LoginLink from '../../../components/login-link'
import {useAuth} from '../../../hooks'
import fetchApi from '../../../utils/fetch-api'
import fetchPoll from '../../../utils/fetchPoll'

// Candidate for its own hook, like `const [state] = importSku(request)`
const LoggedInMenu = ({request, onImported}: ImportableSkuProps) => {
  const [skuImportUrl, setSkuImportUrl] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [label, setLabel] = useState('Find nearby')

  const {accessToken} = useAuth()

  const importSku = useCallback(async () => {
    setImporting(true)
    setLabel('Finding product…')

    const response = await fetchApi('/api/skus/import', 'POST', JSON.stringify(request))

    if (response.status === 201) {
      const json = (await response.json()) as SkuImportResponse

      setSkuImportUrl(json.url)
    } else {
      setImporting(false)
      throw new Error(`Bad response status ${response.status}`)
    }
  }, [request])

  useEffect(() => {
    const fetchSkuImport = async () => {
      if (skuImportUrl === null || skuImportUrl === '') {
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
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const json = (await response.json()) as SkuImportResponseFinished

      const skuResponse = await fetchApi(json.skuUrl, 'POST', JSON.stringify(request))

      if (skuResponse.ok) {
        const skuResponseJson = (await skuResponse.json()) as NearbyInventoryResponse
        onImported(skuResponseJson)
      } else {
        throw new Error('what!')
        // some error state here
      }
    }
    fetchSkuImport()
  }, [skuImportUrl, onImported, request, accessToken])

  return (
    <button class="isinstock-button" onClick={importSku} disabled={importing}>
      <img class="isinstock-logo" width="16" height="16" src={chrome.runtime.getURL(`images/logos/isinstock.svg`)} />
      <span>{label}</span>
    </button>
  )
}

const LoginPrompt = () => {
  return (
    <div class="select-menu login-prompt">
      <div class="grow">
        <img class="mx-auto h-12 w-auto" src={chrome.runtime.getURL('images/logos/isinstock.svg')} />
        <h1 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Is In Stock</h1>
      </div>
      <div>
        <LoginLink />
      </div>
    </div>
  )
}

const LoggedOutMenu = () => {
  return (
    <details>
      <summary class="isinstock-button">
        <img class="isinstock-logo" width="16" height="16" src={chrome.runtime.getURL('images/logos/isinstock.svg')} />
        <span>Find nearby</span>
      </summary>
      <details-menu>
        <LoginPrompt />
      </details-menu>
    </details>
  )
}

type ImportableSkuProps = {
  request: NearbyInventoryProductRequest
  onImported: StateUpdater<null | NearbyInventoryResponse>
}

const ImportableSku = ({request, onImported}: ImportableSkuProps) => {
  const {isLoggedIn} = useAuth()

  if (isLoggedIn) {
    return <LoggedInMenu request={request} onImported={onImported} />
  }

  return <LoggedOutMenu />
}

export default ImportableSku
