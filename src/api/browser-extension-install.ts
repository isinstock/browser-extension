import fetchApi from '../utils/fetch-api'
import {FetchError} from '../utils/fetch-error'

export type BrowserExtensionInstallResponseToken = {
  token: string
}

export type BrowserExtensionInstallResponseError = {
  error: string
}

export type BrowserExtensionInstallResponse =
  | BrowserExtensionInstallResponseToken
  | BrowserExtensionInstallResponseError

export async function createBrowserExtensionInstall(version: string): Promise<BrowserExtensionInstallResponseToken> {
  const body = JSON.stringify({version})
  const response = await fetchApi('/api/browser-extension-installs', 'POST', body)
  if (!response.ok) {
    throw new FetchError(response)
  }

  return (await response.json()) as BrowserExtensionInstallResponseToken
}

export async function updateBrowserExtensionInstall(
  token: string,
  version: string,
): Promise<BrowserExtensionInstallResponseToken | Response> {
  const path = `/api/browser-extension-installs/${token}`
  const body = JSON.stringify({version})
  const response = await fetchApi(path, 'PATCH', body)
  if (!response.ok) {
    throw new FetchError(response)
  }

  return (await response.json()) as BrowserExtensionInstallResponseToken
}
