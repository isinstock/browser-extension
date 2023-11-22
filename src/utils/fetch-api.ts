import {extensionApi} from './extension-api'

const fetchApi = async (
  path: string,
  method: 'POST' | 'GET',
  body?: BodyInit | null | undefined,
  signal?: AbortSignal | null | undefined,
) => {
  const {accessToken} = await extensionApi.storage.local.get({
    accessToken: '',
  })

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Extension-Version': VERSION,
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
    await extensionApi.storage.local.remove('accessToken')
  }

  return response
}

export default fetchApi
