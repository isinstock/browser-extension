import {render} from 'preact'
import browser from 'webextension-polyfill'
import {ElementPickerCommand, MessageAction, SelectorEntry} from '../@types/messages'
import {captureException, initSentry} from '../utils/sentry'

initSentry('element-picker')
import {DebugPanel} from '../components/debug-panel'
import {PickerPanel} from '../components/picker-panel'
import type {ClassFrequencyCache} from '../utils/class-frequency-cache'
import {buildClassFrequencyCache} from '../utils/class-frequency-cache'
import {findCollection, lastCollectionTrace} from '../utils/collection-selector'
import type {CollectionResult, CollectionTrace} from '../utils/collection-selector'
import {computeSelector, lastTrace} from '../utils/compute-selector'
import type {SelectorTrace} from '../utils/compute-selector'
import {getAvailableAttributes} from '../utils/element-attributes'
import {PagePaddingManager} from '../utils/page-padding'
import {getSelectionColor} from '../utils/selection-colors'

declare const __DEV__: boolean

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
  elements: HTMLElement[]
  cssSelector: string
  extract: ExtractMode
  attributeName: string
  preview: string
}

type PickerMode = 'click' | 'advanced'

interface PickerState {
  active: boolean
  sessionId: string
  selections: Map<string, SelectionState>
  hoveredSelectionId: string | null
  pickerMode: PickerMode
  advancedMatchedElements: HTMLElement[]
  advancedInputValid: boolean
  advancedQuery: string
  saving: boolean
  error: string | null
  validating: boolean
  validationError: string | null
  collectionResult: CollectionResult | null
  collectionElements: HTMLElement[]
}

const state: PickerState = {
  active: false,
  sessionId: '',
  selections: new Map(),
  hoveredSelectionId: null,
  pickerMode: 'click',
  advancedMatchedElements: [],
  advancedInputValid: true,
  advancedQuery: '',
  saving: false,
  error: null,
  validating: false,
  validationError: null,
  collectionResult: null,
  collectionElements: [],
}

const elementToSelectionId = new WeakMap<HTMLElement, string>()

let classFrequencyCache: ClassFrequencyCache | undefined

// --- Highlight styles (injected once, uses data attributes on actual elements) ---

const highlightStyle = document.createElement('style')
highlightStyle.textContent = `
  [data-isinstock-hover] {
    outline: 2px solid #00aae7 !important;
    outline-offset: -1px !important;
  }

  [data-isinstock-selected] {
    outline: 2px solid var(--isinstock-border) !important;
    outline-offset: -1px !important;
    position: relative;
  }

  [data-isinstock-badge]::before {
    content: attr(data-isinstock-badge);
    position: absolute;
    top: -8px;
    left: -8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--isinstock-badge);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: none;
    z-index: 2147483645;
    line-height: 1;
  }

  [data-isinstock-collection] {
    outline: 2px dashed #00aae7 !important;
    outline-offset: -1px !important;
  }

  [data-isinstock-advanced] {
    outline: 2px solid #6350e9 !important;
    outline-offset: -1px !important;
  }

  [data-isinstock-picker-active] {
    user-select: none !important;
    -webkit-user-select: none !important;
  }
`
document.documentElement.appendChild(highlightStyle)

// --- Debug panel (dev only, separate host so it's not clipped by the bottom-anchored panel) ---

let debugTrace: SelectorTrace | null = null
let debugCollectionTrace: CollectionTrace | null = null
let debugHost: HTMLDivElement | null = null
let debugShadow: ShadowRoot | null = null
let debugRoot: HTMLDivElement | null = null

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  debugHost = document.createElement('div')
  debugHost.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    z-index: 2147483647;
    pointer-events: none;
  `
  document.documentElement.appendChild(debugHost)
  debugShadow = debugHost.attachShadow({mode: 'open'})
  debugRoot = document.createElement('div')
  debugShadow.appendChild(debugRoot)
}

function renderDebugPanel() {
  if (!debugRoot) return
  render(<DebugPanel trace={debugTrace} collectionTrace={debugCollectionTrace} mode={state.pickerMode} />, debugRoot)
}

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

// Keep page scrollable behind the panel by adding bottom padding that
// matches the panel's rendered height (updated via ResizeObserver).
const pagePadding = new PagePaddingManager()

const shadow = panelHost.attachShadow({mode: 'open'})

// Preact render target inside shadow DOM
const panelRoot = document.createElement('div')
shadow.appendChild(panelRoot)

// --- Preact rendering ---

function renderPanel() {
  const selections = Array.from(state.selections.values()).map(s => ({
    id: s.id,
    cssSelector: s.cssSelector,
    extract: s.extract,
    attributeName: s.attributeName,
    preview: s.preview,
    availableAttributes: getAvailableAttributes(s.elements),
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
      validating={state.validating}
      validationError={state.validationError}
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
    case ElementPickerCommand.EditSelector:
      if (opts?.selectionId && opts?.selector !== undefined) {
        updateSelectionSelector(opts.selectionId, opts.selector)
      }
      break
  }
}

// Cross-hover: panel row → page element
function handleSelectionHoverStart(selectionId: string) {
  const selection = state.selections.get(selectionId)
  if (!selection) return

  state.hoveredSelectionId = selectionId
  selection.elements[0]!.dataset.isinstockHover = ''
}

function handleSelectionHoverEnd(selectionId: string) {
  if (state.hoveredSelectionId !== selectionId) return

  const selection = state.selections.get(selectionId)
  if (selection) {
    delete selection.elements[0]!.dataset.isinstockHover
  }
  state.hoveredSelectionId = null
}

// --- Advanced mode ---

function setPickerMode(mode: PickerMode) {
  state.pickerMode = mode
  if (mode !== 'advanced') {
    clearAdvancedHighlights()
    clearCollectionHighlights()
    state.advancedQuery = ''
    state.advancedInputValid = true
  }
  browser.storage.local.set({pickerMode: mode})
  renderPanel()
}

function clearAdvancedHighlights() {
  for (const el of state.advancedMatchedElements) {
    delete el.dataset.isinstockAdvanced
  }
  state.advancedMatchedElements = []
}

// --- Collection detection (shift+hover) ---

function clearCollectionHighlights() {
  for (const el of state.collectionElements) {
    delete el.dataset.isinstockCollection
  }
  state.collectionElements = []
  state.collectionResult = null
}

function runAdvancedQuery(selector: string) {
  clearAdvancedHighlights()
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
    el.dataset.isinstockAdvanced = ''
  }

  renderPanel()
}

function addAdvancedSelector() {
  const selector = state.advancedQuery.trim()
  if (!selector || state.advancedMatchedElements.length === 0) return

  const matchedElements = state.advancedMatchedElements
  const preview = matchedElements
    .slice(0, 3)
    .map(el => (el.textContent ?? '').trim().substring(0, 40))
    .filter(Boolean)
    .join(', ')

  const id = crypto.randomUUID()
  const badgeNumber = state.selections.size + 1
  markSelected(matchedElements, badgeNumber)

  const selection: SelectionState = {
    id,
    elements: matchedElements,
    cssSelector: selector,
    extract: 'text_content',
    attributeName: '',
    preview: preview.substring(0, 120) || 'Element',
  }

  state.selections.set(id, selection)
  for (const el of matchedElements) {
    elementToSelectionId.set(el, id)
  }

  clearAdvancedHighlights()
  state.advancedQuery = ''
  state.advancedInputValid = true

  renderPanel()
  debouncedSendUpdate()
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

function getSelectors(): SelectorEntry[] {
  return Array.from(state.selections.values()).map(s => ({
    label: s.preview.substring(0, 60) || 'Element',
    cssSelector: s.cssSelector,
    extract: s.extract,
    attributeName: s.attributeName,
    preview: s.preview,
  }))
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

// --- Highlight management (data attributes on actual elements) ---

function markSelected(elements: HTMLElement[], badgeNumber: number) {
  const color = getSelectionColor(badgeNumber - 1)
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!
    el.dataset.isinstockSelected = ''
    el.style.setProperty('--isinstock-border', color.border)
    el.style.setProperty('--isinstock-badge', color.badge)
    // Only the first element in a multi-element selection gets the badge
    if (i === 0) {
      el.dataset.isinstockBadge = String(badgeNumber)
    }
  }
}

function unmarkSelected(elements: HTMLElement[]) {
  for (const el of elements) {
    delete el.dataset.isinstockSelected
    delete el.dataset.isinstockBadge
    el.style.removeProperty('--isinstock-border')
    el.style.removeProperty('--isinstock-badge')
  }
}

// --- Badge renumbering ---

function updateBadgeNumbers() {
  let index = 0
  for (const selection of state.selections.values()) {
    const color = getSelectionColor(index)
    for (let i = 0; i < selection.elements.length; i++) {
      const el = selection.elements[i]!
      el.style.setProperty('--isinstock-border', color.border)
      el.style.setProperty('--isinstock-badge', color.badge)
      if (i === 0) {
        el.dataset.isinstockBadge = String(index + 1)
      }
    }
    index++
  }
}

// --- Selection management ---

function addSelection(el: HTMLElement) {
  const id = crypto.randomUUID()
  const cssSelector = computeSelector(el, classFrequencyCache)
  const preview = extractPreview(el, 'text_content', '')
  const badgeNumber = state.selections.size + 1
  markSelected([el], badgeNumber)

  const selection: SelectionState = {
    id,
    elements: [el],
    cssSelector,
    extract: 'text_content',
    attributeName: '',
    preview,
  }

  state.selections.set(id, selection)
  elementToSelectionId.set(el, id)

  renderPanel()
  debouncedSendUpdate()
}

function addCollectionSelection(result: CollectionResult) {
  const id = crypto.randomUUID()
  const preview = result.elements
    .slice(0, 3)
    .map(el => (el.textContent ?? '').trim().substring(0, 40))
    .filter(Boolean)
    .join(', ')

  const badgeNumber = state.selections.size + 1
  markSelected(result.elements, badgeNumber)

  const selection: SelectionState = {
    id,
    elements: result.elements,
    cssSelector: result.selector,
    extract: 'text_content',
    attributeName: '',
    preview: preview.substring(0, 120) || 'Collection',
  }

  state.selections.set(id, selection)
  for (const el of result.elements) {
    elementToSelectionId.set(el, id)
  }

  clearCollectionHighlights()

  renderPanel()
  debouncedSendUpdate()
}

function removeSelection(id: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  unmarkSelected(selection.elements)
  for (const el of selection.elements) {
    elementToSelectionId.delete(el)
  }
  state.selections.delete(id)

  updateBadgeNumbers()
  renderPanel()
  debouncedSendUpdate()
}

function updateSelectionExtract(id: string, extract: ExtractMode) {
  const selection = state.selections.get(id)
  if (!selection) return

  selection.extract = extract
  if (extract === 'text_content') {
    selection.attributeName = ''
  }
  selection.preview = extractPreview(selection.elements[0]!, extract, selection.attributeName)

  renderPanel()
  debouncedSendUpdate()
}

function updateSelectionAttribute(id: string, attributeName: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  selection.attributeName = attributeName
  selection.preview = extractPreview(selection.elements[0]!, selection.extract, attributeName)

  renderPanel()
  debouncedSendUpdate()
}

function updateSelectionSelector(id: string, newSelector: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  let newElements: HTMLElement[]
  try {
    const nodes = document.querySelectorAll(newSelector)
    newElements = Array.from(nodes).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !isPickerUI(el),
    )
  } catch {
    // Invalid selector — don't update
    return
  }

  // Unmark old elements
  unmarkSelected(selection.elements)
  for (const el of selection.elements) {
    elementToSelectionId.delete(el)
  }

  // Update selection state
  selection.cssSelector = newSelector
  selection.elements = newElements

  // Re-mark with highlights
  const index = Array.from(state.selections.keys()).indexOf(id)
  if (newElements.length > 0) {
    markSelected(newElements, index + 1)
    for (const el of newElements) {
      elementToSelectionId.set(el, id)
    }
    selection.preview = extractPreview(newElements[0]!, selection.extract, selection.attributeName)
  } else {
    selection.preview = '(no matches)'
  }

  renderPanel()
  debouncedSendUpdate()
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

let hoveredElement: HTMLElement | null = null

function isPickerUI(el: Element): boolean {
  return el === panelHost || panelHost.contains(el)
}

function onMouseOver(e: MouseEvent) {
  if (!state.active) return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  // Shift+hover: detect collection and highlight all matching elements
  if (e.shiftKey) {
    clearCollectionHighlights()
    const result = findCollection(target)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      debugTrace = null
      debugCollectionTrace = lastCollectionTrace
      renderDebugPanel()
    }
    if (result) {
      state.collectionResult = result
      // Clear regular hover
      if (hoveredElement) {
        delete hoveredElement.dataset.isinstockHover
        hoveredElement = null
      }
      for (const el of result.elements) {
        el.dataset.isinstockCollection = ''
        state.collectionElements.push(el)
      }
      return
    }
  } else if (state.collectionElements.length > 0) {
    clearCollectionHighlights()
  }

  // Regular hover highlight
  if (hoveredElement && hoveredElement !== target) {
    delete hoveredElement.dataset.isinstockHover
  }
  target.dataset.isinstockHover = ''
  hoveredElement = target

  // Debug panel: preview selector evaluation for hovered element
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    computeSelector(target, classFrequencyCache)
    debugTrace = lastTrace
    debugCollectionTrace = null
    renderDebugPanel()
  }

  // Cross-hover: page element → panel row highlight
  const id = elementToSelectionId.get(target)
  if (id) {
    const row = shadow.querySelector(`[data-selection-id="${id}"]`) as HTMLElement | null
    if (row) row.classList.add('highlighted')
  }
}

function onMouseOut(e: MouseEvent) {
  if (!state.active) return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  if (hoveredElement === target) {
    delete hoveredElement.dataset.isinstockHover
    hoveredElement = null
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      debugTrace = null
      debugCollectionTrace = null
      renderDebugPanel()
    }
  }
  if (state.collectionElements.length > 0) {
    clearCollectionHighlights()
  }

  const id = elementToSelectionId.get(target)
  if (id) {
    const row = shadow.querySelector(`[data-selection-id="${id}"]`) as HTMLElement | null
    if (row) row.classList.remove('highlighted')
  }
}

function onClick(e: MouseEvent) {
  if (!state.active) return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()

  // Shift+click: add the detected collection as a multi-element selection
  if (e.shiftKey && state.collectionResult) {
    addCollectionSelection(state.collectionResult)
    return
  }

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

async function activate() {
  state.active = true
  classFrequencyCache = buildClassFrequencyCache()

  const stored = await browser.storage.local.get('pickerMode')
  if (stored.pickerMode === 'click' || stored.pickerMode === 'advanced') {
    state.pickerMode = stored.pickerMode
  }

  document.documentElement.dataset.isinstockPickerActive = ''
  panelHost.style.display = 'block'
  pagePadding.start(panelHost)
  renderPanel()
  renderDebugPanel()
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
  state.validating = false
  state.validationError = null

  // Clear hover
  if (hoveredElement) {
    delete hoveredElement.dataset.isinstockHover
    hoveredElement = null
  }
  debugTrace = null
  debugCollectionTrace = null
  renderDebugPanel()

  delete document.documentElement.dataset.isinstockPickerActive
  pagePadding.stop(panelHost)

  destroyInPagePanel()

  // Clear all selection highlights
  for (const selection of state.selections.values()) {
    unmarkSelected(selection.elements)
  }
  state.selections.clear()

  clearAdvancedHighlights()
  clearCollectionHighlights()
  state.advancedQuery = ''
  state.advancedInputValid = true
  classFrequencyCache = undefined

  document.removeEventListener('mouseover', onMouseOver, true)
  document.removeEventListener('mouseout', onMouseOut, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function teardown() {
  cleanup()
  highlightStyle.remove()
  debugHost?.remove()
  panelHost.remove()
  browser.runtime.onMessage.removeListener(onMessage)
  delete (window as any).__isinstockPickerLoaded
}

// Wait for StartElementPicker message to show validating state, then
// PageValidationPassed to activate or PageValidationFailed to show error.
function onMessage(msg: unknown) {
  const message = msg as {
    action: string
    sessionId?: string
    error?: string
    message?: string
    subscriptionUrl?: string
  }
  if (message.action === MessageAction.StartElementPicker && message.sessionId) {
    state.sessionId = message.sessionId
    state.validating = true
    state.validationError = null
    panelHost.style.display = 'block'
    renderPanel()
  } else if (message.action === MessageAction.PageValidationPassed) {
    state.validating = false
    activate()
  } else if (message.action === MessageAction.PageValidationFailed) {
    state.validating = false
    state.validationError = message.message ?? 'This page cannot be tracked.'
    renderPanel()
  } else if (message.action === MessageAction.ElementPickerError && message.error) {
    showError(message.error)
  } else if (message.action === MessageAction.ElementPickerSaved) {
    state.saving = false
    cleanup()
  }
}

browser.runtime.onMessage.addListener(onMessage)
