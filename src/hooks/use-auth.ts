import {useEffect, useState} from 'preact/hooks'

import {extensionApi} from '../utils/extension-api'

export default function useAuth(): {isLoggedIn: boolean; accessToken: string | null} {
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const fetchAccessToken = async () => {
      const {accessToken: localAccessToken} = await extensionApi.storage.local.get('accessToken')
      setAccessToken(localAccessToken)
    }

    fetchAccessToken()
  }, [])

  useEffect(() => {
    const handleStorageOnChanged = (changes: Record<string, extensionApi.storage.StorageChange>, _areaName: string) => {
      if ('accessToken' in changes) {
        setAccessToken(changes.accessToken.newValue)
      }
    }

    extensionApi.storage.onChanged.addListener(handleStorageOnChanged)

    return () => {
      extensionApi.storage.onChanged.removeListener(handleStorageOnChanged)
    }
  }, [])

  return {
    accessToken,
    isLoggedIn: accessToken !== null && accessToken !== '',
  }
}
