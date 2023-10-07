const fetchApi = async (path: string, method: 'POST' | 'GET', body?: BodyInit | null | undefined) => {
  const {accessToken} = await chrome.storage.local.get({
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
  })

  // Access token is not valid
  if (response.status === 401) {
    await chrome.storage.local.remove('accessToken')
  }

  return response
}

export default fetchApi
