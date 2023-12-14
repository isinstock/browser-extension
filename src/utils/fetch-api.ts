import browser from 'webextension-polyfill'

import {getBrowserExtensionInstallToken} from './browser-extension-install-token'

const browserExtensionInstallTokenHeader = 'X-Browser-Extension-Install-Token'
const browserExtensionVersionHeader = 'X-Browser-Extension-Version'
const manifest = browser.runtime.getManifest()
const version = manifest.version

const fetchApi = async (
  path: string,
  method: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE',
  body?: BodyInit | null | undefined,
  signal?: AbortSignal | null | undefined,
) => {
  const {accessToken} = await browser.storage.local.get({
    accessToken: '',
  })
  const browserExtensionInstallToken = await getBrowserExtensionInstallToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    [browserExtensionVersionHeader]: version,
    [browserExtensionInstallTokenHeader]: browserExtensionInstallToken,
  }
  if (accessToken !== '' && accessToken !== null) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const input = path[0] === '/' ? `${ISINSTOCK_URL}${path}` : path

  const response = await fetch(input, {
    method,
    mode: 'cors',
    cache: 'no-cache',
    headers,
    body,
    signal,
  })

  // Access token is not valid
  if (response.status === 401) {
    await browser.storage.local.remove('accessToken')
  }

  return response
}

export default fetchApi
