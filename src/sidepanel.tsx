import {render} from 'preact'
import {useState, useEffect, useCallback, useRef} from 'preact/hooks'
import {ElementPickerCommand, MessageAction} from './@types/messages'
import type {PickerSelectionInfo, AdvancedPreviewItem, ElementPickerStateSyncMessage} from './@types/messages'
import {useAccessToken} from './hooks'

type AppView = 'subscriptions' | 'picker'
type PickerMode = 'click' | 'advanced'

const PICKER_MODE_STORAGE_KEY = 'pickerMode'

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

function SubscriptionsView({onTrackNew}: {onTrackNew: () => void}) {
  const {accessToken, isLoggedIn} = useAccessToken()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        <div class="view-content">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
                <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p class="empty-state-title">Sign in to get started</p>
            <p class="empty-state-body">Track products and get notified when they're back in stock or prices drop.</p>
            <a href={`${ISINSTOCK_URL}/users/login`} target="_blank" rel="noreferrer" class="btn btn-primary">
              Sign in
            </a>
          </div>
        </div>
        <div class="view-footer">
          <button class="btn btn-primary btn-full" onClick={onTrackNew}>
            Track new
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div class="view">
        <div class="view-content">
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
        <div class="view-content">
          <div class="empty-state">
            <p class="empty-state-body">{error}</p>
          </div>
        </div>
        <div class="view-footer">
          <button class="btn btn-primary btn-full" onClick={onTrackNew}>
            Track new
          </button>
        </div>
      </div>
    )
  }

  return (
    <div class="view">
      <div class="view-content">
        {subscriptions.length === 0 ? (
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
                <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </div>
            <p class="empty-state-title">No products yet</p>
            <p class="empty-state-body">Start tracking products to see them here.</p>
          </div>
        ) : (
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
        )}
      </div>
      <div class="view-footer">
        <button class="btn btn-primary btn-full" onClick={onTrackNew}>
          Track new
        </button>
      </div>
    </div>
  )
}

function SegmentedControl({value, onChange}: {value: PickerMode; onChange: (mode: PickerMode) => void}) {
  return (
    <div class="segment-control">
      <button class={`segment ${value === 'click' ? 'active' : ''}`} onClick={() => onChange('click')}>
        Basic
      </button>
      <button class={`segment ${value === 'advanced' ? 'active' : ''}`} onClick={() => onChange('advanced')}>
        Advanced
      </button>
    </div>
  )
}

function SelectorRow({
  selection,
  index,
  onCommand,
}: {
  selection: PickerSelectionInfo
  index: number
  onCommand: (command: ElementPickerCommand, opts?: Record<string, string>) => void
}) {
  return (
    <div class="selector-row">
      <div class="row-badge">{index + 1}</div>
      <div class="row-preview">
        {selection.extract === 'attribute' && selection.attributeName ? (
          selection.preview || <span class="muted">(empty)</span>
        ) : selection.extract === 'attribute' && !selection.attributeName ? (
          <span class="muted">(select an attribute)</span>
        ) : (
          selection.preview || '(empty)'
        )}
      </div>
      <div class="row-controls">
        <select
          class="extract-select"
          value={selection.extract}
          onChange={e =>
            onCommand(ElementPickerCommand.ChangeExtract, {
              selectionId: selection.id,
              extract: (e.target as HTMLSelectElement).value,
            })
          }
        >
          <option value="text_content">Text</option>
          <option value="attribute">Attribute</option>
        </select>
        {selection.extract === 'attribute' && (
          <select
            class="extract-select"
            value={selection.attributeName}
            onChange={e =>
              onCommand(ElementPickerCommand.ChangeAttribute, {
                selectionId: selection.id,
                attributeName: (e.target as HTMLSelectElement).value,
              })
            }
          >
            <option value="" disabled selected={!selection.attributeName}>
              Select attribute…
            </option>
            {selection.availableAttributes.map(attr => (
              <option key={attr} value={attr}>
                {attr}
              </option>
            ))}
          </select>
        )}
        <button
          class="remove-btn"
          title="Remove selection"
          onClick={() => onCommand(ElementPickerCommand.Remove, {selectionId: selection.id})}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function AdvancedPanel({
  advancedMatchCount,
  advancedPreviews,
  advancedInputValid,
  advancedQuery,
  sendCommand,
}: {
  advancedMatchCount: number
  advancedPreviews: AdvancedPreviewItem[]
  advancedInputValid: boolean
  advancedQuery: string
  sendCommand: (command: ElementPickerCommand, opts?: Record<string, string>) => void
}) {
  const [localQuery, setLocalQuery] = useState(advancedQuery)
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalQuery(advancedQuery)
  }, [advancedQuery])

  const handleInput = (value: string) => {
    setLocalQuery(value)
    if (queryTimer.current !== null) clearTimeout(queryTimer.current)
    queryTimer.current = setTimeout(() => {
      queryTimer.current = null
      sendCommand(ElementPickerCommand.RunAdvancedQuery, {selector: value})
    }, 300)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && advancedMatchCount > 0 && advancedInputValid) {
      e.preventDefault()
      sendCommand(ElementPickerCommand.AddAdvancedSelector)
    }
  }

  const canAdd = advancedMatchCount > 0 && advancedInputValid

  return (
    <div class="advanced-section">
      <div class="advanced-input-row">
        <input
          class={`advanced-input ${!advancedInputValid && localQuery.trim() ? 'invalid' : ''}`}
          type="text"
          placeholder="Enter a CSS selector, e.g. .price, #total"
          spellcheck={false}
          autocomplete="off"
          value={localQuery}
          onInput={e => handleInput((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
        />
        <button
          class="btn btn-add"
          disabled={!canAdd}
          onClick={() => sendCommand(ElementPickerCommand.AddAdvancedSelector)}
        >
          Add Selector
        </button>
      </div>
      {localQuery.trim() && (
        <div class="advanced-match-info">
          {!advancedInputValid ? (
            <span class="match-count zero">Invalid selector</span>
          ) : (
            <>
              <span class={`match-count ${advancedMatchCount === 0 ? 'zero' : ''}`}>{advancedMatchCount}</span> element
              {advancedMatchCount === 1 ? '' : 's'} match
            </>
          )}
        </div>
      )}
      {advancedPreviews.length > 0 && (
        <div class="advanced-preview-list">
          {advancedPreviews.map((item, i) => (
            <div key={i} class="advanced-preview-item">
              {item.text || <span class="muted">{`<${item.tagName}>`}</span>}
            </div>
          ))}
          {advancedMatchCount > advancedPreviews.length && (
            <div class="advanced-preview-item muted">…and {advancedMatchCount - advancedPreviews.length} more</div>
          )}
        </div>
      )}
    </div>
  )
}

function PickerView({onBack}: {onBack: () => void}) {
  const [selections, setSelections] = useState<PickerSelectionInfo[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [pickerMode, setPickerMode] = useState<PickerMode>('click')
  const [advancedMatchCount, setAdvancedMatchCount] = useState(0)
  const [advancedPreviews, setAdvancedPreviews] = useState<AdvancedPreviewItem[]>([])
  const [advancedInputValid, setAdvancedInputValid] = useState(true)
  const [advancedQuery, setAdvancedQuery] = useState('')
  const [modeLoaded, setModeLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chrome.storage.local.get(PICKER_MODE_STORAGE_KEY, result => {
      const stored = result[PICKER_MODE_STORAGE_KEY]
      if (stored === 'click' || stored === 'advanced') {
        setPickerMode(stored)
      }
      setModeLoaded(true)
    })
  }, [])

  useEffect(() => {
    const listener = (message: Record<string, unknown>) => {
      if (message.action === MessageAction.ElementPickerStateSync) {
        const sync = message as unknown as ElementPickerStateSyncMessage
        if (sync.sessionId) setSessionId(sync.sessionId)
        setSelections(sync.selections)
        setPickerMode(sync.pickerMode)
        setAdvancedMatchCount(sync.advancedMatchCount)
        setAdvancedPreviews(sync.advancedPreviews)
        setAdvancedInputValid(sync.advancedInputValid)
        setAdvancedQuery(sync.advancedQuery)
      } else if (message.action === MessageAction.ElementPickerSaved) {
        onBack()
      } else if (message.action === MessageAction.ElementPickerError) {
        setSaving(false)
        setError((message as {error: string}).error)
      }
    }
    chrome.runtime.onMessage.addListener(listener)

    chrome.runtime.sendMessage({action: MessageAction.ElementPickerSidePanelReady})

    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const sendCommand = useCallback(
    (command: ElementPickerCommand, opts?: Record<string, string>) => {
      chrome.runtime.sendMessage({
        action: MessageAction.ElementPickerCommand,
        sessionId,
        command,
        ...opts,
      })
    },
    [sessionId],
  )

  const handleModeChange = useCallback(
    (mode: PickerMode) => {
      setPickerMode(mode)
      chrome.storage.local.set({[PICKER_MODE_STORAGE_KEY]: mode})
      sendCommand(ElementPickerCommand.SetMode, {mode})
    },
    [sendCommand],
  )

  useEffect(() => {
    if (modeLoaded && sessionId) {
      sendCommand(ElementPickerCommand.SetMode, {mode: pickerMode})
    }
  }, [modeLoaded, sessionId])

  const handleDone = useCallback(() => {
    setSaving(true)
    setError(null)
    sendCommand(ElementPickerCommand.Done)
  }, [sendCommand])

  const handleCancel = useCallback(() => {
    sendCommand(ElementPickerCommand.Cancel)
    onBack()
  }, [sendCommand, onBack])

  return (
    <div class="view">
      <div class="picker-header">
        <button class="btn-back" onClick={handleCancel} title="Back to subscriptions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <SegmentedControl value={pickerMode} onChange={handleModeChange} />
      </div>

      {pickerMode === 'click' ? (
        <div class="selector-list">
          {selections.length === 0 ? (
            <div class="empty-state">
              <p class="empty-state-body">Click any element on the page to start tracking it</p>
            </div>
          ) : (
            selections.map((sel, i) => <SelectorRow key={sel.id} selection={sel} index={i} onCommand={sendCommand} />)
          )}
        </div>
      ) : (
        <div class="selector-list">
          <AdvancedPanel
            advancedMatchCount={advancedMatchCount}
            advancedPreviews={advancedPreviews}
            advancedInputValid={advancedInputValid}
            advancedQuery={advancedQuery}
            sendCommand={sendCommand}
          />
          {selections.length > 0 && (
            <>
              <div class="added-selectors-label">Added selectors</div>
              {selections.map((sel, i) => (
                <SelectorRow key={sel.id} selection={sel} index={i} onCommand={sendCommand} />
              ))}
            </>
          )}
        </div>
      )}

      <div class="toolbar">
        {error && <div class="toolbar-error">{error}</div>}
        <span>
          {selections.length} element{selections.length === 1 ? '' : 's'} selected
        </span>
        <div class="toolbar-actions">
          <button class="btn btn-primary" disabled={selections.length === 0 || saving} onClick={handleDone}>
            {saving ? 'Saving…' : 'Done'}
          </button>
          <button class="btn btn-secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [view, setView] = useState<AppView>('subscriptions')

  return view === 'subscriptions' ? (
    <SubscriptionsView onTrackNew={() => setView('picker')} />
  ) : (
    <PickerView onBack={() => setView('subscriptions')} />
  )
}

render(<App />, document.getElementById('root')!)
