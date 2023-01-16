import {useEffect, useState} from 'preact/hooks'

export function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const fetchAccessToken = async () => {
      const {accessToken: localAccessToken} = await chrome.storage.local.get('accessToken')
      setAccessToken(localAccessToken)
    }

    fetchAccessToken()
  }, [])

  useEffect(() => {
    const handleStorageOnChanged = (changes: Record<string, chrome.storage.StorageChange>, namespace: string) => {
      console.log('handleStorageOnChanged', namespace)
      if ('accessToken' in changes) {
        setAccessToken(changes.accessToken.newValue)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageOnChanged)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageOnChanged)
    }
  }, [])

  return {
    accessToken,
  }
}
