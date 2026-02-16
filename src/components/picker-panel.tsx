import {useState, useEffect, useRef} from 'preact/hooks'
import {ElementPickerCommand} from '../@types/messages'
import type {PickerSelectionInfo, AdvancedPreviewItem} from '../@types/messages'
import {getSelectionColor} from '../utils/selection-colors'
import styles from './picker-panel.css'

type PickerMode = 'click' | 'advanced'

export interface PickerPanelProps {
  selections: PickerSelectionInfo[]
  pickerMode: PickerMode
  advancedMatchCount: number
  advancedPreviews: AdvancedPreviewItem[]
  advancedInputValid: boolean
  advancedQuery: string
  saving: boolean
  error: string | null
  validating?: boolean
  validationError?: string | null
  onCommand: (command: ElementPickerCommand, opts?: Record<string, string>) => void
  onBack?: () => void
  onSelectionHoverStart?: (selectionId: string) => void
  onSelectionHoverEnd?: (selectionId: string) => void
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
  pickerMode,
  onCommand,
  onHoverStart,
  onHoverEnd,
}: {
  selection: PickerSelectionInfo
  index: number
  pickerMode: PickerMode
  onCommand: (command: ElementPickerCommand, opts?: Record<string, string>) => void
  onHoverStart?: (selectionId: string) => void
  onHoverEnd?: (selectionId: string) => void
}) {
  if (pickerMode === 'advanced') {
    return (
      <div
        class="selector-row"
        data-selection-id={selection.id}
        onMouseEnter={() => onHoverStart?.(selection.id)}
        onMouseLeave={() => onHoverEnd?.(selection.id)}
      >
        <div class="row-badge" style={{background: getSelectionColor(index).badge}}>
          {index + 1}
        </div>
        <div class="row-selector">{selection.cssSelector}</div>
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

  return (
    <div
      class="selector-row"
      data-selection-id={selection.id}
      onMouseEnter={() => onHoverStart?.(selection.id)}
      onMouseLeave={() => onHoverEnd?.(selection.id)}
    >
      <div class="row-badge" style={{background: getSelectionColor(index).badge}}>
        {index + 1}
      </div>
      <div class="row-preview">{selection.preview || '(empty)'}</div>
      <button
        class="remove-btn"
        title="Remove selection"
        onClick={() => onCommand(ElementPickerCommand.Remove, {selectionId: selection.id})}
      >
        ×
      </button>
    </div>
  )
}

function AdvancedPanel({
  advancedMatchCount,
  advancedPreviews,
  advancedInputValid,
  advancedQuery,
  onCommand,
}: {
  advancedMatchCount: number
  advancedPreviews: AdvancedPreviewItem[]
  advancedInputValid: boolean
  advancedQuery: string
  onCommand: (command: ElementPickerCommand, opts?: Record<string, string>) => void
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
      onCommand(ElementPickerCommand.RunAdvancedQuery, {selector: value})
    }, 300)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && advancedMatchCount > 0 && advancedInputValid) {
      e.preventDefault()
      onCommand(ElementPickerCommand.AddAdvancedSelector)
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
          onClick={() => onCommand(ElementPickerCommand.AddAdvancedSelector)}
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

export function PickerPanel({
  selections,
  pickerMode,
  advancedMatchCount,
  advancedPreviews,
  advancedInputValid,
  advancedQuery,
  saving,
  error,
  validating,
  validationError,
  onCommand,
  onBack,
  onSelectionHoverStart,
  onSelectionHoverEnd,
}: PickerPanelProps) {
  const handleModeChange = (mode: PickerMode) => {
    onCommand(ElementPickerCommand.SetMode, {mode})
  }

  const handleDone = () => {
    onCommand(ElementPickerCommand.Done)
  }

  const handleCancel = () => {
    onCommand(ElementPickerCommand.Cancel)
  }

  const stopKeyboard = (e: Event) => e.stopPropagation()

  if (validating) {
    return (
      <div class="picker-panel" onKeyDown={stopKeyboard} onKeyUp={stopKeyboard} onKeyPress={stopKeyboard}>
        <style>{styles}</style>
        <div class="validation-state">
          <div class="validation-spinner" />
          <p class="validation-text">Checking page…</p>
        </div>
      </div>
    )
  }

  if (validationError) {
    return (
      <div class="picker-panel" onKeyDown={stopKeyboard} onKeyUp={stopKeyboard} onKeyPress={stopKeyboard}>
        <style>{styles}</style>
        <div class="validation-state">
          <svg
            class="validation-error-icon"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            stroke-width="1.5"
          >
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p class="validation-error-title">Can't track this page</p>
          <p class="validation-error-message">{validationError}</p>
          <button class="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div class="picker-panel" onKeyDown={stopKeyboard} onKeyUp={stopKeyboard} onKeyPress={stopKeyboard}>
      <style>{styles}</style>
      <div class="picker-header">
        {onBack && (
          <button class="btn-back" onClick={handleCancel} title="Back to subscriptions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}
        <SegmentedControl value={pickerMode} onChange={handleModeChange} />
      </div>

      {pickerMode === 'click' ? (
        <div class="selector-list">
          {selections.length === 0 ? (
            <div class="empty-state">
              <p class="empty-state-body">Click any element on the page to start tracking it</p>
            </div>
          ) : (
            selections.map((sel, i) => (
              <SelectorRow
                key={sel.id}
                selection={sel}
                index={i}
                pickerMode={pickerMode}
                onCommand={onCommand}
                onHoverStart={onSelectionHoverStart}
                onHoverEnd={onSelectionHoverEnd}
              />
            ))
          )}
        </div>
      ) : (
        <div class="selector-list">
          <AdvancedPanel
            advancedMatchCount={advancedMatchCount}
            advancedPreviews={advancedPreviews}
            advancedInputValid={advancedInputValid}
            advancedQuery={advancedQuery}
            onCommand={onCommand}
          />
          {selections.length > 0 && (
            <>
              <div class="added-selectors-label">Added selectors</div>
              {selections.map((sel, i) => (
                <SelectorRow
                  key={sel.id}
                  selection={sel}
                  index={i}
                  pickerMode={pickerMode}
                  onCommand={onCommand}
                  onHoverStart={onSelectionHoverStart}
                  onHoverEnd={onSelectionHoverEnd}
                />
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
