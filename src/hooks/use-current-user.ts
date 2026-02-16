import {useEffect, useState} from 'preact/hooks'
import type {CurrentUser} from '../@types/api'
import {useAccessToken} from './index'

export default function useCurrentUser(): {
  user: CurrentUser | null
  loading: boolean
  error: string | null
} {
  const {accessToken, isLoggedIn} = useAccessToken()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn) {
      setUser(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const fetchUser = async () => {
      setLoading(true)
      setError(null)

      try {
        const resp = await fetch(`${ISINSTOCK_URL}/api/me`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (cancelled) return

        if (!resp.ok) {
          if (resp.status === 401) {
            chrome.storage.local.remove('accessToken')
            return
          }
          throw new Error(`Failed to fetch user (${resp.status})`)
        }

        const data = (await resp.json()) as CurrentUser
        if (!cancelled) {
          setUser(data)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load user')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchUser()

    return () => {
      cancelled = true
    }
  }, [accessToken, isLoggedIn])

  return {user, loading, error}
}
