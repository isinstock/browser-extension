const fetchApi = async (path: string, method: string, body: BodyInit | null | undefined) => {
  const {accessToken} = await chrome.storage.local.get({
    accessToken: '',
  })

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (accessToken !== '') {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const input = path[0] === '/' ? `${ISINSTOCK_URL}${path}` : path

  return fetch(input, {
    method,
    mode: 'cors',
    cache: 'no-cache',
    headers,
    body,
  })
}

export default fetchApi
