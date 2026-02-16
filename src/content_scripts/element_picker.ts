import browser from 'webextension-polyfill'
import {ElementPickerCommand, MessageAction, SelectorEntry} from '../@types/messages'
import type {ElementPickerCommandMessage} from '../@types/messages'
import styles from './element_picker.css'

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
  row: HTMLDivElement
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

const styleEl = document.createElement('style')
styleEl.textContent = styles
shadow.appendChild(styleEl)

const panel = document.createElement('div')
panel.className = 'panel'
shadow.appendChild(panel)

const errorBar = document.createElement('div')
errorBar.className = 'error'
panel.appendChild(errorBar)

const selectorList = document.createElement('div')
selectorList.className = 'selector-list'
panel.appendChild(selectorList)

const emptyState = document.createElement('div')
emptyState.className = 'empty-state'
emptyState.textContent = 'Click any element on the page to start tracking it'
selectorList.appendChild(emptyState)

// --- Advanced mode section ---

const advancedSection = document.createElement('div')
advancedSection.className = 'advanced-section'
panel.appendChild(advancedSection)

const advancedInputRow = document.createElement('div')
advancedInputRow.className = 'advanced-input-row'
advancedSection.appendChild(advancedInputRow)

const advancedInput = document.createElement('input')
advancedInput.className = 'advanced-input'
advancedInput.type = 'text'
advancedInput.placeholder = 'Enter a CSS selector, e.g. .price, #total, [data-testid="amount"]'
advancedInput.spellcheck = false
advancedInput.autocomplete = 'off'
advancedInputRow.appendChild(advancedInput)

const addSelectorBtn = document.createElement('button')
addSelectorBtn.className = 'btn-add-selector'
addSelectorBtn.textContent = 'Add Selector'
addSelectorBtn.disabled = true
advancedInputRow.appendChild(addSelectorBtn)

const advancedMatchInfo = document.createElement('div')
advancedMatchInfo.className = 'advanced-match-info'
advancedSection.appendChild(advancedMatchInfo)

const advancedPreviewList = document.createElement('div')
advancedPreviewList.className = 'advanced-preview-list'
advancedSection.appendChild(advancedPreviewList)

const toolbar = document.createElement('div')
toolbar.className = 'toolbar'
panel.appendChild(toolbar)

const toolbarLeft = document.createElement('div')
toolbarLeft.style.cssText = 'display: flex; align-items: center; gap: 12px;'
toolbar.appendChild(toolbarLeft)

const countLabel = document.createElement('span')
countLabel.textContent = '0 elements selected'
toolbarLeft.appendChild(countLabel)

const modeToggle = document.createElement('button')
modeToggle.className = 'mode-toggle'
modeToggle.textContent = 'Advanced'
modeToggle.title = 'Switch to CSS selector input'
toolbarLeft.appendChild(modeToggle)

const actions = document.createElement('div')
actions.className = 'toolbar-actions'
toolbar.appendChild(actions)

const doneBtn = document.createElement('button')
doneBtn.className = 'btn btn-done'
doneBtn.textContent = 'Done'
doneBtn.disabled = true
actions.appendChild(doneBtn)

const cancelBtn = document.createElement('button')
cancelBtn.className = 'btn btn-cancel'
cancelBtn.textContent = 'Cancel'
actions.appendChild(cancelBtn)

// --- Render cycle ---

let renderScheduled = false

function scheduleRender() {
  if (!renderScheduled) {
    renderScheduled = true
    requestAnimationFrame(() => {
      renderScheduled = false
      renderToolbar()
    })
  }
}

function renderToolbar() {
  const count = state.selections.size
  countLabel.textContent = `${count} element${count === 1 ? '' : 's'} selected`
  doneBtn.disabled = count === 0
  emptyState.style.display = count === 0 && state.pickerMode === 'click' ? 'block' : 'none'
}

// --- Advanced mode ---

function setPickerMode(mode: PickerMode) {
  state.pickerMode = mode
  if (mode === 'advanced') {
    advancedSection.classList.add('visible')
    emptyState.style.display = 'none'
    modeToggle.textContent = 'Click to select'
    modeToggle.title = 'Switch to click-to-select mode'
    advancedInput.focus()
  } else {
    advancedSection.classList.remove('visible')
    clearAdvancedOverlays()
    advancedInput.value = ''
    advancedMatchInfo.textContent = ''
    advancedPreviewList.textContent = ''
    addSelectorBtn.disabled = true
    advancedInput.classList.remove('invalid')
    modeToggle.textContent = 'Advanced'
    modeToggle.title = 'Switch to CSS selector input'
  }
  scheduleRender()
}

modeToggle.addEventListener('click', () => {
  setPickerMode(state.pickerMode === 'click' ? 'advanced' : 'click')
})

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
  advancedInput.classList.remove('invalid')

  if (!selector.trim()) {
    advancedMatchInfo.textContent = ''
    advancedPreviewList.textContent = ''
    addSelectorBtn.disabled = true
    return
  }

  let elements: NodeListOf<Element>
  try {
    elements = document.querySelectorAll(selector)
  } catch {
    advancedInput.classList.add('invalid')
    advancedMatchInfo.textContent = 'Invalid selector'
    advancedPreviewList.textContent = ''
    addSelectorBtn.disabled = true
    return
  }

  const matched: HTMLElement[] = []
  elements.forEach(el => {
    if (el instanceof HTMLElement && !isPickerUI(el)) {
      matched.push(el)
    }
  })

  state.advancedMatchedElements = matched
  addSelectorBtn.disabled = matched.length === 0

  const countSpan = document.createElement('span')
  countSpan.className = matched.length === 0 ? 'advanced-match-count zero' : 'advanced-match-count'
  countSpan.textContent = String(matched.length)

  advancedMatchInfo.textContent = ''
  advancedMatchInfo.appendChild(countSpan)
  advancedMatchInfo.appendChild(document.createTextNode(` element${matched.length === 1 ? '' : 's'} match`))

  advancedPreviewList.textContent = ''
  const previewLimit = 5
  for (let i = 0; i < Math.min(matched.length, previewLimit); i++) {
    const el = matched[i]!
    const item = document.createElement('div')
    item.className = 'advanced-preview-item'
    const text = (el.textContent ?? '').trim().substring(0, 80)
    if (text) {
      item.textContent = text
    } else {
      const muted = document.createElement('span')
      muted.className = 'muted'
      muted.textContent = `<${el.tagName.toLowerCase()}>`
      item.appendChild(muted)
    }
    advancedPreviewList.appendChild(item)
  }

  if (matched.length > previewLimit) {
    const more = document.createElement('div')
    more.className = 'advanced-preview-item muted'
    more.textContent = `\u2026and ${matched.length - previewLimit} more`
    advancedPreviewList.appendChild(more)
  }

  for (const el of matched) {
    state.advancedOverlays.push(createAdvancedOverlay(el))
  }
}

let advancedQueryTimer: ReturnType<typeof setTimeout> | null = null

advancedInput.addEventListener('input', () => {
  if (advancedQueryTimer !== null) clearTimeout(advancedQueryTimer)
  advancedQueryTimer = setTimeout(() => {
    advancedQueryTimer = null
    runAdvancedQuery(advancedInput.value)
  }, 300)
})

advancedInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !addSelectorBtn.disabled) {
    e.preventDefault()
    addAdvancedSelector()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    if (advancedInput.value) {
      advancedInput.value = ''
      runAdvancedQuery('')
    } else {
      setPickerMode('click')
    }
  }
})

function addAdvancedSelector() {
  const selector = advancedInput.value.trim()
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
    row: null!,
  }

  if (!state.useSidePanel) {
    const row = buildSelectorRow(selection, badgeNumber)
    selection.row = row
    selectorList.appendChild(row)
    row.scrollIntoView({behavior: 'smooth', block: 'nearest'})
  }

  state.selections.set(id, selection)
  elementToSelectionId.set(firstElement, id)

  clearAdvancedOverlays()
  advancedInput.value = ''
  advancedMatchInfo.textContent = ''
  advancedPreviewList.textContent = ''
  addSelectorBtn.disabled = true

  scheduleRender()
  debouncedSendUpdate()
  sendStateSync()
}

addSelectorBtn.addEventListener('click', addAdvancedSelector)

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
  const overlay = document.createElement('div')
  overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #32B91C;
      background: rgba(50, 185, 28, 0.08);
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
      background: #32B91C;
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
  let index = 1
  for (const selection of state.selections.values()) {
    const badge = selection.overlay.querySelector('[data-overlay-badge]') as HTMLElement | null
    if (badge) badge.textContent = String(index)

    if (selection.row) {
      const rowBadge = selection.row.querySelector('.row-badge') as HTMLElement | null
      if (rowBadge) rowBadge.textContent = String(index)
    }

    index++
  }
}

// --- Row building ---

function buildSelectorRow(selection: SelectionState, badgeNumber: number): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'selector-row'
  row.dataset.id = selection.id

  const badge = document.createElement('div')
  badge.className = 'row-badge'
  badge.textContent = String(badgeNumber)
  row.appendChild(badge)

  const preview = document.createElement('div')
  preview.className = 'row-preview'
  updatePreviewElement(preview, selection)
  row.appendChild(preview)

  const controls = document.createElement('div')
  controls.className = 'row-controls'
  row.appendChild(controls)

  const extractSelect = document.createElement('select')
  extractSelect.className = 'extract-select'
  extractSelect.dataset.action = 'extract'

  const textOption = document.createElement('option')
  textOption.value = 'text_content'
  textOption.textContent = 'Text'
  extractSelect.appendChild(textOption)

  const attrOption = document.createElement('option')
  attrOption.value = 'attribute'
  attrOption.textContent = 'Attribute'
  extractSelect.appendChild(attrOption)

  extractSelect.value = selection.extract
  controls.appendChild(extractSelect)

  const attrSelect = document.createElement('select')
  attrSelect.className = 'extract-select'
  attrSelect.dataset.action = 'attribute'
  attrSelect.style.display = selection.extract === 'attribute' ? 'inline' : 'none'
  attrSelect.dataset.attrSelect = 'true'

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Select attribute\u2026'
  placeholder.disabled = true
  placeholder.selected = !selection.attributeName
  attrSelect.appendChild(placeholder)

  for (const attr of getElementAttributes(selection.element)) {
    const opt = document.createElement('option')
    opt.value = attr
    opt.textContent = attr
    if (attr === selection.attributeName) opt.selected = true
    attrSelect.appendChild(opt)
  }
  controls.appendChild(attrSelect)

  const removeBtn = document.createElement('button')
  removeBtn.className = 'remove-btn'
  removeBtn.dataset.action = 'remove'
  removeBtn.textContent = '\u00d7'
  removeBtn.title = 'Remove selection'
  controls.appendChild(removeBtn)

  return row
}

function updatePreviewElement(previewEl: HTMLElement, selection: SelectionState) {
  previewEl.textContent = ''

  if (selection.extract === 'attribute' && selection.attributeName) {
    const value = selection.element.getAttribute(selection.attributeName)
    if (value !== null) {
      previewEl.textContent = value.trim().substring(0, 120) || '(empty)'
    } else {
      const muted = document.createElement('span')
      muted.className = 'muted'
      muted.textContent = '(attribute not found)'
      previewEl.appendChild(muted)
    }
  } else if (selection.extract === 'attribute' && !selection.attributeName) {
    const muted = document.createElement('span')
    muted.className = 'muted'
    muted.textContent = '(select an attribute)'
    previewEl.appendChild(muted)
  } else {
    const text = (selection.element.textContent ?? '').trim().substring(0, 120)
    previewEl.textContent = text || '(empty)'
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
    row: null!,
  }

  if (!state.useSidePanel) {
    const row = buildSelectorRow(selection, badgeNumber)
    selection.row = row
    selectorList.appendChild(row)
    row.scrollIntoView({behavior: 'smooth', block: 'nearest'})
  }

  state.selections.set(id, selection)
  elementToSelectionId.set(el, id)

  scheduleRender()
  debouncedSendUpdate()
  sendStateSync()
}

function removeSelection(id: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  if (selection.row) {
    selection.row.classList.add('removing')
    selection.row.addEventListener(
      'animationend',
      () => {
        selection.row.remove()
      },
      {once: true},
    )
  }

  selection.overlay.remove()
  elementToSelectionId.delete(selection.element)
  state.selections.delete(id)

  updateBadgeNumbers()
  scheduleRender()
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

  if (selection.row) {
    const attrSelect = selection.row.querySelector('[data-attr-select]') as HTMLElement | null
    if (attrSelect) {
      attrSelect.style.display = extract === 'attribute' ? 'inline' : 'none'
    }

    const previewEl = selection.row.querySelector('.row-preview') as HTMLElement | null
    if (previewEl) updatePreviewElement(previewEl, selection)
  }

  debouncedSendUpdate()
  sendStateSync()
}

function updateSelectionAttribute(id: string, attributeName: string) {
  const selection = state.selections.get(id)
  if (!selection) return

  selection.attributeName = attributeName
  selection.preview = extractPreview(selection.element, selection.extract, attributeName)

  if (selection.row) {
    const previewEl = selection.row.querySelector('.row-preview') as HTMLElement | null
    if (previewEl) updatePreviewElement(previewEl, selection)
  }

  debouncedSendUpdate()
  sendStateSync()
}

// --- Event delegation on selector list ---

selectorList.addEventListener('click', e => {
  const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
  if (!target) return
  const action = target.dataset.action
  const id = target.closest('[data-id]')?.getAttribute('data-id')
  if (!id) return

  if (action === 'remove') {
    removeSelection(id)
  }
})

selectorList.addEventListener('change', e => {
  const target = e.target as HTMLElement
  if (!target.dataset.action) return
  const id = target.closest('[data-id]')?.getAttribute('data-id')
  if (!id) return

  if (target.dataset.action === 'extract') {
    updateSelectionExtract(id, (target as HTMLSelectElement).value as ExtractMode)
  } else if (target.dataset.action === 'attribute') {
    updateSelectionAttribute(id, (target as HTMLSelectElement).value)
  }
})

// Cross-hover: panel row → page element
selectorList.addEventListener(
  'mouseenter',
  e => {
    const row = (e.target as HTMLElement).closest('.selector-row') as HTMLElement | null
    if (!row) return
    const id = row.dataset.id
    if (!id) return

    const selection = state.selections.get(id)
    if (!selection) return

    state.hoveredSelectionId = id
    hoverOverlay.style.display = 'block'
    positionOverlay(hoverOverlay, selection.element)
  },
  true,
)

selectorList.addEventListener(
  'mouseleave',
  e => {
    const row = (e.target as HTMLElement).closest('.selector-row') as HTMLElement | null
    if (!row) return
    const id = row.dataset.id
    if (!id || state.hoveredSelectionId !== id) return

    state.hoveredSelectionId = null
    hoverOverlay.style.display = 'none'
  },
  true,
)

// --- Error display ---

function showError(message: string) {
  errorBar.textContent = message
  errorBar.style.display = 'block'
  panelHost.style.display = 'block'
  setTimeout(() => {
    errorBar.style.display = 'none'
    if (!state.active) panelHost.style.display = 'none'
  }, 5000)
}

// --- Page event handlers ---

function isPickerUI(el: Element): boolean {
  return el === panelHost || el === hoverOverlay || panelHost.contains(el)
}

function onMouseOver(e: MouseEvent) {
  if (!state.active) return
  if (state.pickerMode === 'advanced') return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  hoverOverlay.style.display = 'block'
  positionOverlay(hoverOverlay, target)

  // Cross-hover: page element → panel row highlight
  const id = elementToSelectionId.get(target)
  if (id) {
    const selection = state.selections.get(id)
    if (selection) selection.row.classList.add('highlighted')
  }
}

function onMouseOut(e: MouseEvent) {
  if (!state.active) return
  if (state.pickerMode === 'advanced') return
  const target = e.target as HTMLElement
  if (isPickerUI(target)) return

  hoverOverlay.style.display = 'none'

  const id = elementToSelectionId.get(target)
  if (id) {
    const selection = state.selections.get(id)
    if (selection) selection.row.classList.remove('highlighted')
  }
}

function onClick(e: MouseEvent) {
  if (!state.active) return
  if (state.pickerMode === 'advanced') return
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
  }
  scheduleRender()
  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('mouseout', onMouseOut, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
}

function cleanup() {
  state.active = false
  hoverOverlay.style.display = 'none'
  panelHost.style.display = 'none'

  for (const selection of state.selections.values()) {
    selection.overlay.remove()
  }
  state.selections.clear()

  // Clear advanced mode state
  clearAdvancedOverlays()
  advancedInput.value = ''
  advancedMatchInfo.textContent = ''
  advancedPreviewList.textContent = ''
  addSelectorBtn.disabled = true
  advancedInput.classList.remove('invalid')
  advancedSection.classList.remove('visible')
  state.pickerMode = 'click'
  modeToggle.textContent = 'Advanced'

  // Clear panel rows, keep emptyState
  const rows = selectorList.querySelectorAll('.selector-row')
  rows.forEach(row => row.remove())

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

// Toolbar button handlers
doneBtn.addEventListener('click', () => {
  if (state.selections.size > 0) sendComplete()
})

cancelBtn.addEventListener('click', () => {
  sendCancel()
})

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
    }
  }
}

browser.runtime.onMessage.addListener(onMessage)
