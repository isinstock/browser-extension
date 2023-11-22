import {useEffect, useState} from 'preact/hooks'
import browser from 'webextension-polyfill'

export default function useAuth(): {isLoggedIn: boolean; accessToken: string | null} {
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const fetchAccessToken = async () => {
      const {accessToken: localAccessToken} = await browser.storage.local.get('accessToken')
      setAccessToken(localAccessToken)
    }

    fetchAccessToken()
  }, [])

  useEffect(() => {
    const handleStorageOnChanged = (changes: Record<string, browser.Storage.StorageChange>, _areaName: string) => {
      if ('accessToken' in changes) {
        setAccessToken(changes.accessToken.newValue)
      }
    }

    browser.storage.onChanged.addListener(handleStorageOnChanged)

    return () => {
      browser.storage.onChanged.removeListener(handleStorageOnChanged)
    }
  }, [])

  return {
    accessToken,
    isLoggedIn: accessToken !== null && accessToken !== '',
  }
}
