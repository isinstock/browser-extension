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

  return fetch(`${ISINSTOCK_URL}${path}`, {
    method,
    mode: 'cors',
    cache: 'no-cache',
    headers,
    body,
  })
}

export default fetchApi
