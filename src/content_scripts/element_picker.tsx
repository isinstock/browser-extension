import {render} from 'preact'
import browser from 'webextension-polyfill'
import {ElementPickerCommand, MessageAction, SelectorEntry} from '../@types/messages'
import type {ElementPickerCommandMessage, PickerSelectionInfo} from '../@types/messages'
import {PickerPanel} from '../components/picker-panel'
import {getSelectionColor} from '../utils/selection-colors'

// The background script checks __isinstockPickerLoaded before injecting
// this file, so this guard is just a safety net for edge cases (e.g.,
// rapid double-injection before the first execution completes).
if ((window as any).__isinstockPickerLoaded) {
  // Script already loaded — the existing message listener handles re-activation.
  throw new Error('Element picker already loaded, skipping re-initialization')
}
;(window as any).__isinstockPickerLoaded = true

type ExtractMode = 'text_content' | 'attribute'

interface SelectionState {
  id: string
  element: HTMLElement
  cssSelector: string
  extract: ExtractMode
  attributeName: string
  preview: string
  overlay: HTMLDivElement
}

type PickerMode = 'click' | 'advanced'

interface PickerState {
  active: boolean
  sessionId: string
  useSidePanel: boolean
  selections: Map<string, SelectionState>
  hoveredSelectionId: string | null
  pickerMode: PickerMode
  advancedOverlays: HTMLDivElement[]
  advancedMatchedElements: HTMLElement[]
  advancedInputValid: boolean
  advancedQuery: string
  saving: boolean
  error: string | null
}

const state: PickerState = {
  active: false,
  sessionId: '',
  useSidePanel: false,
  selections: new Map(),
  hoveredSelectionId: null,
  pickerMode: 'click',
  advancedOverlays: [],
  advancedMatchedElements: [],
  advancedInputValid: true,
  advancedQuery: '',
  saving: false,
  error: null,
}

const elementToSelectionId = new WeakMap<HTMLElement, string>()

// Hover overlay (lives in the page, not shadow DOM)
const hoverOverlay = document.createElement('div')
hoverOverlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px solid #00aae7;
    background: rgba(0, 170, 231, 0.08);
    border-radius: 3px;
    z-index: 2147483646;
    transition: top 75ms ease, left 75ms ease, width 75ms ease, height 75ms ease;
    display: none;
  `
document.documentElement.appendChild(hoverOverlay)

// Panel host using Shadow DOM for style isolation
const panelHost = document.createElement('div')
panelHost.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    display: none;
  `
document.documentElement.appendChild(panelHost)

const shadow = panelHost.attachShadow({mode: 'open'})

// Preact render target inside shadow DOM
const panelRoot = document.createElement('div')
shadow.appendChild(panelRoot)

// --- Preact rendering ---

function renderPanel() {
  if (state.useSidePanel) return

  const selections: PickerSelectionInfo[] = Array.from(state.selections.values()).map(s => ({
    id: s.id,
    cssSelector: s.cssSelector,
    extract: s.extract,
    attributeName: s.attributeName,
    preview: s.preview,
    availableAttributes: getElementAttributes(s.element),
  }))

  render(
    <PickerPanel
      selections={selections}
      pickerMode={state.pickerMode}
      advancedMatchCount={state.advancedMatchedElements.length}
      advancedPreviews={state.advancedMatchedElements.slice(0, 5).map(el => ({
        text: (el.textContent ?? '').trim().substring(0, 80),
        tagName: el.tagName.toLowerCase(),
      }))}
      advancedInputValid={state.advancedInputValid}
      advancedQuery={state.advancedQuery}
      saving={state.saving}
      error={state.error}
      onCommand={handlePanelCommand}
      onSelectionHoverStart={handleSelectionHoverStart}
      onSelectionHoverEnd={handleSelectionHoverEnd}
    />,
    panelRoot,
  )
}

function handlePanelCommand(command: ElementPickerCommand, opts?: Record<string, string>) {
  switch (command) {
    case ElementPickerCommand.Remove:
      if (opts?.selectionId) removeSelection(opts.selectionId)
      break
    case ElementPickerCommand.ChangeExtract:
      if (opts?.selectionId && opts?.extract) updateSelectionExtract(opts.selectionId, opts.extract as ExtractMode)
      break
    case ElementPickerCommand.ChangeAttribute:
      if (opts?.selectionId && opts?.attributeName !== undefined)
        updateSelectionAttribute(opts.selectionId, opts.attributeName)
      break
    case ElementPickerCommand.Done:
      if (state.selections.size > 0) {
        state.saving = true
        state.error = null
        renderPanel()
        sendComplete()
      }
      break
    case ElementPickerCommand.Cancel:
      sendCancel()
      break
    case ElementPickerCommand.SetMode:
      if (opts?.mode) {
        setPickerMode(opts.mode as PickerMode)
      }
      break
    case ElementPickerCommand.RunAdvancedQuery:
      if (opts?.selector !== undefined) {
        runAdvancedQuery(opts.selector)
      }
      break
    case ElementPickerCommand.AddAdvancedSelector:
      addAdvancedSelector()
      break
  }
}

// Cross-hover: panel row → page element
function handleSelectionHoverStart(selectionId: string) {
  const selection = state.selections.get(selectionId)
  if (!selection) return

  state.hoveredSelectionId = selectionId
  hoverOverlay.style.display = 'block'
  positionOverlay(hoverOverlay, selection.element)
}

function handleSelectionHoverEnd(selectionId: string) {
  if (state.hoveredSelectionId !== selectionId) return

  state.hoveredSelectionId = null
  hoverOverlay.style.display = 'none'
}

// --- Advanced mode ---

function setPickerMode(mode: PickerMode) {
  state.pickerMode = mode
  if (mode !== 'advanced') {
    clearAdvancedOverlays()
    state.advancedQuery = ''
    state.advancedInputValid = true
  }
  renderPanel()
  sendStateSync()
}

function clearAdvancedOverlays() {
  for (const overlay of state.advancedOverlays) {
    overlay.remove()
  }
  state.advancedOverlays = []
  state.advancedMatchedElements = []
}

function createAdvancedOverlay(el: HTMLElement): HTMLDivElement {
  const overlay = document.createElement('div')
  overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #6350e9;
      background: rgba(99, 80, 233, 0.1);
      border-radius: 3px;
      z-index: 2147483644;
    `
  positionOverlay(overlay, el)
  document.documentElement.appendChild(overlay)
  return overlay
}

function runAdvancedQuery(selector: string) {
  clearAdvancedOverlays()
  state.advancedQuery = selector
  state.advancedInputValid = true

  if (!selector.trim()) {
    renderPanel()
    return
  }

  let elements: NodeListOf<Element>
  try {
    elements = document.querySelectorAll(selector)
  } catch {
    state.advancedInputValid = false
    renderPanel()
    return
  }

  const matched: HTMLElement[] = []
  elements.forEach(el => {
    if (el instanceof HTMLElement && !isPickerUI(el)) {
      matched.push(el)
    }
  })

  state.advancedMatchedElements = matched

  for (const el of matched) {
    state.advancedOverlays.push(createAdvancedOverlay(el))
  }

  renderPanel()
}

function addAdvancedSelector() {
  const selector = state.advancedQuery.trim()
  if (!selector || state.advancedMatchedElements.length === 0) return

  const firstElement = state.advancedMatchedElements[0]!
  const preview = state.advancedMatchedElements
    .slice(0, 3)
    .map(el => (el.textContent ?? '').trim().substring(0, 40))
    .filter(Boolean)
    .join(', ')

  const id = crypto.randomUUID()
  const badgeNumber = state.selections.size + 1
  const overlay = createSelectedOverlay(firstElement, badgeNumber)

  const selection: SelectionState = {
    id,
    element: firstElement,
    cssSelector: selector,
    extract: 'text_content',
    attributeName: '',
    preview: preview.substring(0, 120) || 'Element',
    overlay,
  }

  state.selections.set(id, selection)
  elementToSelectionId.set(firstElement, id)

  clearAdvancedOverlays()
  state.advancedQuery = ''
  state.advancedInputValid = true

  renderPanel()
  debouncedSendUpdate()
  sendStateSync()
}

// --- Debounced message sending ---

let updateTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSendUpdate() {
  if (updateTimer !== null) clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    updateTimer = null
    sendUpdate()
  }, 150)
}

function sendUpdate() {
  if (updateTimer !== null) {
    clearTimeout(updateTimer)
    updateTimer = null
  }
  browser.runtime.sendMessage({
    action: MessageAction.ElementPickerUpdate,
    sessionId: state.sessionId,
    selectors: getSelectors(),
  })
}

function sendComplete() {
  browser.runtime.sendMessage({
    action: MessageAction.ElementPickerComplete,
    sessionId: state.sessionId,
    selectors: getSelectors(),
  })
  cleanup()
}

function sendCancel() {
  browser.runtime.sendMessage({
    action: MessageAction.ElementPickerCancel,
    sessionId: state.sessionId,
  })
  cleanup()
}

function sendStateSync() {
  if (!state.useSidePanel) return

  const previewLimit = 5
  const advancedPreviews = state.advancedMatchedElements.slice(0, previewLimit).map(el => ({
    text: (el.textContent ?? '').trim().substring(0, 80),
    tagName: el.tagName.toLowerCase(),
  }))

  browser.runtime.sendMessage({
    action: MessageAction.ElementPickerStateSync,
    sessionId: state.sessionId,
    selections: Array.from(state.selections.values()).map(s => ({
      id: s.id,
      cssSelector: s.cssSelector,
      extract: s.extract,
      attributeName: s.attributeName,
      preview: s.preview,
      availableAttributes: getElementAttributes(s.element),
    })),
    pickerMode: state.pickerMode,
    advancedMatchCount: state.advancedMatchedElements.length,
    advancedPreviews,
    advancedInputValid: state.advancedInputValid,
    advancedQuery: state.advancedQuery,
  })
}

function getSelectors(): SelectorEntry[] {
  return Array.from(state.selections.values()).map(s => ({
    label: s.preview.substring(0, 60) || 'Element',
    cssSelector: s.cssSelector,
    extract: s.extract,
    attributeName: s.attributeName,
    preview: s.preview,
  }))
}

// --- Element attributes ---

const NOISE_ATTRIBUTES = new Set(['class', 'style', 'id'])
const CONTENT_ATTRIBUTES = ['href', 'src', 'value', 'content', 'alt', 'title', 'datetime']

function getElementAttributes(el: HTMLElement): string[] {
  const attrs = Array.from(el.attributes).map(a => a.name)
  const filtered = attrs.filter(a => !NOISE_ATTRIBUTES.has(a))

  const dataAttrs: string[] = []
  const contentAttrs: string[] = []
  const rest: string[] = []

  for (const attr of filtered) {
    if (attr.startsWith('data-')) {
      dataAttrs.push(attr)
    } else if (CONTENT_ATTRIBUTES.includes(attr)) {
      contentAttrs.push(attr)
    } else {
      rest.push(attr)
    }
  }

  dataAttrs.sort()
  contentAttrs.sort((a, b) => CONTENT_ATTRIBUTES.indexOf(a) - CONTENT_ATTRIBUTES.indexOf(b))
  rest.sort()

  return [...dataAttrs, ...contentAttrs, ...rest]
}

// --- Preview ---

function extractPreview(el: HTMLElement, extract: ExtractMode, attributeName: string): string {
  if (extract === 'attribute') {
    if (!attributeName) return ''
    const value = el.getAttribute(attributeName)
    return value !== null ? value.trim().substring(0, 120) : ''
  }
  return (el.textContent ?? '').trim().substring(0, 120)
}

// --- Selector computation ---

function computeSelector(el: Element): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`
  }

  if (el.classList.length > 0) {
    const classSelector = Array.from(el.classList)
      .map(c => `.${CSS.escape(c)}`)
      .join('')
    const tagSelector = `${el.tagName.toLowerCase()}${classSelector}`
    if (document.querySelectorAll(tagSelector).length === 1) {
      return tagSelector
    }
  }

  const parts: string[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase()
    const parent: Element | null = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        parts.unshift(`${tag}:nth-of-type(${index})`)
      } else {
        parts.unshift(tag)
      }
    } else {
      parts.unshift(tag)
    }
    current = parent
  }
  return parts.join(' > ')
}

// --- Overlay ---

function positionOverlay(overlay: HTMLElement, el: Element) {
  const rect = el.getBoundingClientRect()
  overlay.style.top = `${rect.top + window.scrollY}px`
  overlay.style.left = `${rect.left + window.scrollX}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
}

function createSelectedOverlay(el: HTMLElement, badgeNumber: number): HTMLDivElement {
  const color = getSelectionColor(badgeNumber - 1)
  const overlay = document.createElement('div')
  overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid ${color.border};
      background: ${color.background};
      border-radius: 3px;
      z-index: 2147483645;
      overflow: visible;
    `
  positionOverlay(overlay, el)

  const badge = document.createElement('div')
  badge.style.cssText = `
      position: absolute;
      top: -8px;
      left: -8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${color.badge};
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: none;
    `
  badge.textContent = String(badgeNumber)
  badge.dataset.overlayBadge = 'true'
  overlay.appendChild(badge)

  document.documentElement.appendChild(overlay)
  return overlay
}

// --- Badge renumbering ---

function updateBadgeNumbers() {
  let index = 0
  for (const selection of state.selections.values()) {
    const color = getSelectionColor(index)
    const badge = selection.overlay.querySelector('[data-overlay-badge]') as HTMLElement | null
    if (badge) {
      badge.textContent = String(index + 1)
      badge.style.background = color.badge
    }
    selection.overlay.style.borderColor = color.border
    selection.overlay.style.background = color.background
    index++
  }
}

// --- Selection management ---

function addSelection(el: HTMLElement) {
  const id = crypto.randomUUID()
  const cssSelector = computeSelector(el)
  const preview = extractPreview(el, 'text_content', '')
  const badgeNumber = state.selections.size + 1
  const overlay = createSelectedOverlay(el, badgeNumber)

  const selection: SelectionState = {
    id,
    element: el,
    cssSelector,
    extract: 'text_content',
    attributeName: '',
    preview,
    overlay,
  }

  state.selections.set(id, selection)
  elementToSelectionId.set(el, id)

  renderPanel()
  debouncedSendUpdate()
  sendStateSync()
}

function removeSelection(id: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  selection.overlay.remove()
  elementToSelectionId.delete(selection.element)
  state.selections.delete(id)

  updateBadgeNumbers()
  renderPanel()
  debouncedSendUpdate()
  sendStateSync()
}

function updateSelectionExtract(id: string, extract: ExtractMode) {
  const selection = state.selections.get(id)
  if (!selection) return

  selection.extract = extract
  if (extract === 'text_content') {
    selection.attributeName = ''
  }
  selection.preview = extractPreview(selection.element, extract, selection.attributeName)

  renderPanel()
  debouncedSendUpdate()
  sendStateSync()
}

function updateSelectionAttribute(id: string, attributeName: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  selection.attributeName = attributeName
  selection.preview = extractPreview(selection.element, selection.extract, attributeName)

  renderPanel()
  debouncedSendUpdate()
  sendStateSync()
}

// --- Error display ---

function showError(message: string) {
  state.error = message
  panelHost.style.display = 'block'
  renderPanel()
  setTimeout(() => {
    state.error = null
    renderPanel()
    if (!state.active) panelHost.style.display = 'none'
  }, 5000)
}

// --- Page event handlers ---

function isPickerUI(el: Element): boolean {
  return el === panelHost || el === hoverOverlay || panelHost.contains(el)
}

function onMouseOver(e: MouseEvent) {
  if (!state.active) return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  hoverOverlay.style.display = 'block'
  positionOverlay(hoverOverlay, target)

  // Cross-hover: page element → panel row highlight
  if (!state.useSidePanel) {
    const id = elementToSelectionId.get(target)
    if (id) {
      const row = shadow.querySelector(`[data-selection-id="${id}"]`) as HTMLElement | null
      if (row) row.classList.add('highlighted')
    }
  }
}

function onMouseOut(e: MouseEvent) {
  if (!state.active) return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  hoverOverlay.style.display = 'none'

  if (!state.useSidePanel) {
    const id = elementToSelectionId.get(target)
    if (id) {
      const row = shadow.querySelector(`[data-selection-id="${id}"]`) as HTMLElement | null
      if (row) row.classList.remove('highlighted')
    }
  }
}

function onClick(e: MouseEvent) {
  if (!state.active) return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()

  const existingId = elementToSelectionId.get(target)
  if (existingId) {
    removeSelection(existingId)
  } else {
    addSelection(target)
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (!state.active) return
  if (e.key === 'Escape') {
    if (state.pickerMode === 'advanced') return
    e.preventDefault()
    sendCancel()
  }
}

// --- Lifecycle ---

function activate() {
  state.active = true
  if (!state.useSidePanel) {
    panelHost.style.display = 'block'
    renderPanel()
  }
  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('mouseout', onMouseOut, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}

function destroyInPagePanel() {
  render(null, panelRoot)
  panelHost.style.display = 'none'
}

function cleanup() {
  state.active = false
  state.saving = false
  state.error = null
  hoverOverlay.style.display = 'none'

  destroyInPagePanel()

  for (const selection of state.selections.values()) {
    selection.overlay.remove()
  }
  state.selections.clear()

  clearAdvancedOverlays()
  state.advancedQuery = ''
  state.advancedInputValid = true
  state.pickerMode = 'click'

  document.removeEventListener('mouseover', onMouseOver, true)
  document.removeEventListener('mouseout', onMouseOut, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function teardown() {
  cleanup()
  hoverOverlay.remove()
  panelHost.remove()
  browser.runtime.onMessage.removeListener(onMessage)
  delete (window as any).__isinstockPickerLoaded
}

// Wait for StartElementPicker message to get sessionId and activate
function onMessage(msg: unknown) {
  const message = msg as {action: string; sessionId?: string; error?: string; useSidePanel?: boolean}
  if (message.action === MessageAction.StartElementPicker && message.sessionId) {
    state.sessionId = message.sessionId
    state.useSidePanel = message.useSidePanel === true
    activate()
  } else if (message.action === MessageAction.ElementPickerError && message.error) {
    showError(message.error)
  } else if (message.action === MessageAction.ElementPickerSidePanelReady) {
    if (state.active) {
      state.useSidePanel = true
      destroyInPagePanel()
      sendStateSync()
    }
  } else if (message.action === MessageAction.ElementPickerCommand) {
    const cmd = message as unknown as ElementPickerCommandMessage
    switch (cmd.command) {
      case ElementPickerCommand.Remove:
        if (cmd.selectionId) removeSelection(cmd.selectionId)
        break
      case ElementPickerCommand.ChangeExtract:
        if (cmd.selectionId && cmd.extract) updateSelectionExtract(cmd.selectionId, cmd.extract as ExtractMode)
        break
      case ElementPickerCommand.ChangeAttribute:
        if (cmd.selectionId && cmd.attributeName !== undefined)
          updateSelectionAttribute(cmd.selectionId, cmd.attributeName)
        break
      case ElementPickerCommand.Done:
        if (state.selections.size > 0) sendComplete()
        break
      case ElementPickerCommand.Cancel:
        sendCancel()
        break
      case ElementPickerCommand.SetMode:
        if (cmd.mode) setPickerMode(cmd.mode)
        sendStateSync()
        break
      case ElementPickerCommand.RunAdvancedQuery:
        if (cmd.selector !== undefined) {
          runAdvancedQuery(cmd.selector)
          sendStateSync()
        }
        break
      case ElementPickerCommand.AddAdvancedSelector:
        addAdvancedSelector()
        break
    }
  }
}

browser.runtime.onMessage.addListener(onMessage)
