import {render} from 'preact'
import {useState, useEffect, useCallback} from 'preact/hooks'
import {ElementPickerCommand, MessageAction} from './@types/messages'
import type {PickerSelectionInfo} from './@types/messages'

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

function App() {
  const [selections, setSelections] = useState<PickerSelectionInfo[]>([])
  const [sessionId, setSessionId] = useState<string>('')

  useEffect(() => {
    const listener = (message: {action: string; sessionId?: string; selections?: PickerSelectionInfo[]}) => {
      if (message.action === MessageAction.ElementPickerStateSync && message.selections) {
        if (message.sessionId) setSessionId(message.sessionId)
        setSelections(message.selections)
      }
    }
    chrome.runtime.onMessage.addListener(listener)

    // Notify background that the side panel is ready — starts the picker
    // if no session exists, or re-syncs state from an existing session.
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

  return (
    <div class="panel">
      <div class="selector-list">
        {selections.length === 0 ? (
          <div class="empty-state">Click any element on the page to start tracking it</div>
        ) : (
          selections.map((sel, i) => (
            <SelectorRow key={sel.id} selection={sel} index={i} onCommand={sendCommand} />
          ))
        )}
      </div>
      <div class="toolbar">
        <span>
          {selections.length} element{selections.length === 1 ? '' : 's'} selected
        </span>
        <div class="toolbar-actions">
          <button
            class="btn btn-done"
            disabled={selections.length === 0}
            onClick={() => sendCommand(ElementPickerCommand.Done)}
          >
            Done
          </button>
          <button class="btn btn-cancel" onClick={() => sendCommand(ElementPickerCommand.Cancel)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

render(<App />, document.getElementById('root')!)
