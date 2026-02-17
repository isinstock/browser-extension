import {render} from 'preact'
import browser from 'webextension-polyfill'
import {ElementPickerCommand, MessageAction, SelectorEntry} from '../@types/messages'
import {PickerPanel} from '../components/picker-panel'
import type {ClassFrequencyCache} from '../utils/class-frequency-cache'
import {buildClassFrequencyCache} from '../utils/class-frequency-cache'
import {findCollection} from '../utils/collection-selector'
import type {CollectionResult} from '../utils/collection-selector'
import {computeSelector} from '../utils/compute-selector'
import {getAvailableAttributes} from '../utils/element-attributes'
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
  elements: HTMLElement[]
  cssSelector: string
  extract: ExtractMode
  attributeName: string
  preview: string
  overlays: HTMLDivElement[]
}

type PickerMode = 'click' | 'advanced'

interface PickerState {
  active: boolean
  sessionId: string
  selections: Map<string, SelectionState>
  hoveredSelectionId: string | null
  pickerMode: PickerMode
  advancedOverlays: HTMLDivElement[]
  advancedMatchedElements: HTMLElement[]
  advancedInputValid: boolean
  advancedQuery: string
  saving: boolean
  error: string | null
  validating: boolean
  validationError: string | null
  collectionResult: CollectionResult | null
  collectionOverlays: HTMLDivElement[]
}

const state: PickerState = {
  active: false,
  sessionId: '',
  selections: new Map(),
  hoveredSelectionId: null,
  pickerMode: 'click',
  advancedOverlays: [],
  advancedMatchedElements: [],
  advancedInputValid: true,
  advancedQuery: '',
  saving: false,
  error: null,
  validating: false,
  validationError: null,
  collectionResult: null,
  collectionOverlays: [],
}

const elementToSelectionId = new WeakMap<HTMLElement, string>()

let classFrequencyCache: ClassFrequencyCache | undefined

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
  }
}

// Cross-hover: panel row → page element
function handleSelectionHoverStart(selectionId: string) {
  const selection = state.selections.get(selectionId)
  if (!selection) return

  state.hoveredSelectionId = selectionId
  hoverOverlay.style.display = 'block'
  positionOverlay(hoverOverlay, selection.elements[0]!)
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
    clearCollectionOverlays()
    state.advancedQuery = ''
    state.advancedInputValid = true
  }
  browser.storage.local.set({pickerMode: mode})
  renderPanel()
}

function clearAdvancedOverlays() {
  for (const overlay of state.advancedOverlays) {
    overlay.remove()
  }
  state.advancedOverlays = []
  state.advancedMatchedElements = []
}

// --- Collection detection (shift+hover) ---

function clearCollectionOverlays() {
  for (const overlay of state.collectionOverlays) {
    overlay.remove()
  }
  state.collectionOverlays = []
  state.collectionResult = null
}

function createCollectionOverlay(el: HTMLElement): HTMLDivElement {
  const overlay = document.createElement('div')
  overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px dashed #00aae7;
      background: rgba(0, 170, 231, 0.08);
      border-radius: 3px;
      z-index: 2147483644;
    `
  positionOverlay(overlay, el)
  document.documentElement.appendChild(overlay)
  return overlay
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

  const matchedElements = state.advancedMatchedElements
  const preview = matchedElements
    .slice(0, 3)
    .map(el => (el.textContent ?? '').trim().substring(0, 40))
    .filter(Boolean)
    .join(', ')

  const id = crypto.randomUUID()
  const badgeNumber = state.selections.size + 1
  const overlays = matchedElements.map((el, i) => createSelectedOverlay(el, badgeNumber, i > 0))

  const selection: SelectionState = {
    id,
    elements: matchedElements,
    cssSelector: selector,
    extract: 'text_content',
    attributeName: '',
    preview: preview.substring(0, 120) || 'Element',
    overlays,
  }

  state.selections.set(id, selection)
  for (const el of matchedElements) {
    elementToSelectionId.set(el, id)
  }

  clearAdvancedOverlays()
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

// --- Overlay ---

function positionOverlay(overlay: HTMLElement, el: Element) {
  const rect = el.getBoundingClientRect()
  overlay.style.top = `${rect.top + window.scrollY}px`
  overlay.style.left = `${rect.left + window.scrollX}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
}

function createSelectedOverlay(el: HTMLElement, badgeNumber: number, hideBadge = false): HTMLDivElement {
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

  if (!hideBadge) {
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
  }

  document.documentElement.appendChild(overlay)
  return overlay
}

// --- Badge renumbering ---

function updateBadgeNumbers() {
  let index = 0
  for (const selection of state.selections.values()) {
    const color = getSelectionColor(index)
    for (const overlay of selection.overlays) {
      const badge = overlay.querySelector('[data-overlay-badge]') as HTMLElement | null
      if (badge) {
        badge.textContent = String(index + 1)
        badge.style.background = color.badge
      }
      overlay.style.borderColor = color.border
      overlay.style.background = color.background
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
  const overlay = createSelectedOverlay(el, badgeNumber)

  const selection: SelectionState = {
    id,
    elements: [el],
    cssSelector,
    extract: 'text_content',
    attributeName: '',
    preview,
    overlays: [overlay],
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
  const overlays = result.elements.map((el, i) => createSelectedOverlay(el, badgeNumber, i > 0))

  const selection: SelectionState = {
    id,
    elements: result.elements,
    cssSelector: result.selector,
    extract: 'text_content',
    attributeName: '',
    preview: preview.substring(0, 120) || 'Collection',
    overlays,
  }

  state.selections.set(id, selection)
  for (const el of result.elements) {
    elementToSelectionId.set(el, id)
  }

  clearCollectionOverlays()

  renderPanel()
  debouncedSendUpdate()
}

function removeSelection(id: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  for (const overlay of selection.overlays) {
    overlay.remove()
  }
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

  // Shift+hover: detect collection and highlight all matching elements
  if (e.shiftKey && state.pickerMode === 'click') {
    clearCollectionOverlays()
    const result = findCollection(target)
    if (result) {
      state.collectionResult = result
      hoverOverlay.style.display = 'none'
      for (const el of result.elements) {
        state.collectionOverlays.push(createCollectionOverlay(el))
      }
      return
    }
  } else if (state.collectionOverlays.length > 0) {
    clearCollectionOverlays()
  }

  hoverOverlay.style.display = 'block'
  positionOverlay(hoverOverlay, target)

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

  hoverOverlay.style.display = 'none'
  if (state.collectionOverlays.length > 0) {
    clearCollectionOverlays()
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
  if (e.shiftKey && state.collectionResult && state.pickerMode === 'click') {
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

  panelHost.style.display = 'block'
  renderPanel()
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
  hoverOverlay.style.display = 'none'

  destroyInPagePanel()

  for (const selection of state.selections.values()) {
    for (const overlay of selection.overlays) {
      overlay.remove()
    }
  }
  state.selections.clear()

  clearAdvancedOverlays()
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
  hoverOverlay.remove()
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
