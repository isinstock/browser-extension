import {useEffect, useState} from 'preact/hooks'

export default function useAuth(): {isLoggedIn: boolean; accessToken: string | null} {
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const fetchAccessToken = async () => {
      const {accessToken: localAccessToken} = await chrome.storage.local.get('accessToken')
      setAccessToken(localAccessToken)
    }

    fetchAccessToken()
  }, [])

  useEffect(() => {
    const handleStorageOnChanged = (changes: Record<string, chrome.storage.StorageChange>, _areaName: string) => {
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
    isLoggedIn: accessToken !== null && accessToken !== '',
  }
}
