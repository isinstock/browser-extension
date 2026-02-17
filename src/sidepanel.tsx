import {render} from 'preact'
import {useState, useEffect, useCallback, useRef} from 'preact/hooks'
import {MessageAction} from './@types/messages'
import type {CurrentUser} from './@types/api'
import {useAccessToken, useCurrentUser} from './hooks'

interface SubscriptionProduct {
  id: number
  public_id: string
  name: string
  url: string
  image_url: string | null
  availability: string | null
  price: string | null
  retailer_name: string
}

interface Subscription {
  id: number
  subscription_type: string
  created_at: string
  product: SubscriptionProduct
}

function gravatarUrl(email: string, size: number = 80): string {
  const hash = email.trim().toLowerCase()
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`
}

function emailInitial(email: string): string {
  return email.charAt(0).toUpperCase()
}

function Header({user, onDisconnect}: {user: CurrentUser; onDisconnect: () => void}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside, true)
    return () => document.removeEventListener('click', handleClickOutside, true)
  }, [dropdownOpen])

  return (
    <div class="header">
      <div class="header-brand">
        <svg class="header-logo" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            stroke="#00aae7"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="header-title">Is In Stock</span>
      </div>
      <div class="header-avatar-wrapper" ref={dropdownRef}>
        <button class="header-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)} title={user.email}>
          <img
            class="header-avatar"
            src={gravatarUrl(user.email)}
            alt=""
            onError={e => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const fallback = target.nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
          <div class="header-avatar-fallback">{emailInitial(user.email)}</div>
        </button>
        {dropdownOpen && (
          <div class="header-dropdown">
            <div class="header-dropdown-email">{user.email}</div>
            <div class="header-dropdown-divider" />
            <button
              class="header-dropdown-item header-dropdown-item-danger"
              onClick={() => {
                setDropdownOpen(false)
                onDisconnect()
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SubscriptionsView() {
  const {accessToken, isLoggedIn} = useAccessToken()
  const {user} = useCurrentUser()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canTrack, setCanTrack] = useState(false)

  const handleDisconnect = useCallback(() => {
    chrome.storage.local.remove('accessToken')
  }, [])

  const handleTrackNew = useCallback(() => {
    chrome.runtime.sendMessage({action: MessageAction.TrackCurrentPage})
  }, [])

  useEffect(() => {
    const updateCanTrack = (url?: string) => {
      if (!url) {
        setCanTrack(false)
        return
      }
      try {
        const scheme = new URL(url).protocol
        setCanTrack(scheme === 'http:' || scheme === 'https:')
      } catch {
        setCanTrack(false)
      }
    }

    chrome.tabs.query({active: true, currentWindow: true}).then(([tab]) => {
      updateCanTrack(tab?.url)
    })

    const onActivated = ({tabId}: chrome.tabs.OnActivatedInfo) => {
      chrome.tabs.get(tabId).then(tab => updateCanTrack(tab.url))
    }

    const onUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.status === 'complete' || changeInfo.url) {
        chrome.tabs.query({active: true, currentWindow: true}).then(([activeTab]) => {
          if (activeTab?.id === tabId) {
            updateCanTrack(tab.url)
          }
        })
      }
    }

    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false)
      return
    }

    const fetchSubscriptions = async () => {
      try {
        const resp = await fetch(`${ISINSTOCK_URL}/api/inventory-subscriptions`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!resp.ok) {
          if (resp.status === 401) {
            chrome.storage.local.remove('accessToken')
            return
          }
          throw new Error(`Failed to fetch subscriptions (${resp.status})`)
        }

        const data = (await resp.json()) as Subscription[]
        setSubscriptions(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load subscriptions')
      } finally {
        setLoading(false)
      }
    }

    fetchSubscriptions()
  }, [accessToken, isLoggedIn])

  if (!isLoggedIn) {
    return (
      <div class="view">
        <div class="view-content view-content-centered">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
                <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p class="empty-state-title">Connect to get started</p>
            <p class="empty-state-body">Track products and get notified when they're back in stock or prices drop.</p>
            <a href={`${ISINSTOCK_URL}/extension/authorize`} target="_blank" rel="noreferrer" class="btn btn-primary">
              Connect account
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div class="view">
        {user && <Header user={user} onDisconnect={handleDisconnect} />}
        <div class="view-content view-content-centered">
          <div class="loading-state">
            <div class="spinner" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="view">
        {user && <Header user={user} onDisconnect={handleDisconnect} />}
        <div class="view-content view-content-centered">
          <div class="empty-state">
            <p class="empty-state-body">{error}</p>
            <button class="btn btn-primary" onClick={handleTrackNew} disabled={!canTrack}>
              Track new
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (subscriptions.length === 0) {
    return (
      <div class="view">
        {user && <Header user={user} onDisconnect={handleDisconnect} />}
        <div class="view-content view-content-centered">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
                <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </div>
            <p class="empty-state-title">No products yet</p>
            <p class="empty-state-body">Start tracking products to see them here.</p>
            <button class="btn btn-primary" onClick={handleTrackNew} disabled={!canTrack}>
              Track new
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div class="view">
      {user && <Header user={user} onDisconnect={handleDisconnect} />}
      <div class="view-content">
        <div class="subscription-list">
          {subscriptions.map(sub => (
            <a
              key={sub.id}
              href={`${ISINSTOCK_URL}/p/${sub.product.public_id}`}
              target="_blank"
              rel="noreferrer"
              class="subscription-item"
            >
              <div class="subscription-image">
                {sub.product.image_url ? (
                  <img src={sub.product.image_url} alt="" />
                ) : (
                  <div class="subscription-image-placeholder">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
                      <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                  </div>
                )}
              </div>
              <div class="subscription-info">
                <div class="subscription-name">{sub.product.name}</div>
                <div class="subscription-meta">
                  <span class="subscription-retailer">{sub.product.retailer_name}</span>
                  {sub.product.price && <span class="subscription-price">{sub.product.price}</span>}
                </div>
              </div>
              {sub.product.availability && (
                <div
                  class={`subscription-availability ${sub.product.availability === 'in_stock' ? 'available' : 'unavailable'}`}
                  title={sub.product.availability === 'in_stock' ? 'In stock' : 'Out of stock'}
                />
              )}
            </a>
          ))}
        </div>
      </div>
      <div class="view-footer">
        <button class="btn btn-primary btn-full" onClick={handleTrackNew} disabled={!canTrack}>
          Track new
        </button>
      </div>
    </div>
  )
}

function App() {
  return <SubscriptionsView />
}

render(<App />, document.getElementById('root')!)
