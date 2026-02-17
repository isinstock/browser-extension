import {useCallback, useEffect, useState} from 'preact/hooks'
import browser from 'webextension-polyfill'

export default function useAccessToken(): {isLoggedIn: boolean; accessToken: string | null} {
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const readFromStorage = useCallback(async () => {
    const {accessToken: stored} = await browser.storage.local.get('accessToken')
    setAccessToken((stored as string) ?? null)
  }, [])

  // Read on mount
  useEffect(() => {
    readFromStorage()
  }, [readFromStorage])

  // React to storage changes from other contexts (background, other tabs)
  useEffect(() => {
    const handleStorageOnChanged = (changes: Record<string, browser.Storage.StorageChange>, _areaName: string) => {
      if ('accessToken' in changes) {
        setAccessToken((changes.accessToken.newValue as string) ?? null)
      }
    }

    browser.storage.onChanged.addListener(handleStorageOnChanged)

    return () => {
      browser.storage.onChanged.removeListener(handleStorageOnChanged)
    }
  }, [])

  // Re-read from storage when the window regains focus, in case the
  // onChanged event was missed (e.g. after returning from an auth tab).
  useEffect(() => {
    const onFocus = () => readFromStorage()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [readFromStorage])

  return {
    accessToken,
    isLoggedIn: accessToken !== null && accessToken !== '',
  }
}
