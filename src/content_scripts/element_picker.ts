import browser from 'webextension-polyfill'
import {MessageAction, SelectorEntry} from '../@types/messages'

;(function () {
  let sessionId = ''
  let active = false
  let selectionCount = 0

  const selections = new Map<
    HTMLElement,
    {
      overlay: HTMLDivElement
      selector: SelectorEntry
    }
  >()

  // Hover overlay
  const hoverOverlay = document.createElement('div')
  hoverOverlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px solid #4f46e5;
    background: rgba(79, 70, 229, 0.08);
    border-radius: 3px;
    z-index: 2147483646;
    transition: top 75ms ease, left 75ms ease, width 75ms ease, height 75ms ease;
    display: none;
  `
  document.documentElement.appendChild(hoverOverlay)

  // Toolbar using Shadow DOM for style isolation
  const toolbarHost = document.createElement('div')
  toolbarHost.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    display: none;
  `
  document.documentElement.appendChild(toolbarHost)

  const shadow = toolbarHost.attachShadow({mode: 'closed'})
  const toolbarStyle = document.createElement('style')
  toolbarStyle.textContent = `
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #1e1b4b;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
    }
    .toolbar-actions {
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease;
    }
    .btn-done {
      background: #4f46e5;
      color: #fff;
    }
    .btn-done:hover {
      background: #4338ca;
    }
    .btn-done:disabled {
      background: #6366f1;
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-cancel {
      background: transparent;
      color: #c7d2fe;
      border: 1px solid #4338ca;
    }
    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .error {
      display: none;
      padding: 12px 20px;
      background: #7f1d1d;
      color: #fecaca;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      text-align: center;
    }
  `
  shadow.appendChild(toolbarStyle)

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'

  const countLabel = document.createElement('span')
  countLabel.textContent = '0 elements selected'

  const actions = document.createElement('div')
  actions.className = 'toolbar-actions'

  const doneBtn = document.createElement('button')
  doneBtn.className = 'btn btn-done'
  doneBtn.textContent = 'Done'
  doneBtn.disabled = true

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'btn btn-cancel'
  cancelBtn.textContent = 'Cancel'

  const errorBar = document.createElement('div')
  errorBar.className = 'error'

  actions.appendChild(doneBtn)
  actions.appendChild(cancelBtn)
  toolbar.appendChild(countLabel)
  toolbar.appendChild(actions)
  shadow.appendChild(errorBar)
  shadow.appendChild(toolbar)

  function updateToolbar() {
    const count = selections.size
    countLabel.textContent = `${count} element${count === 1 ? '' : 's'} selected`
    doneBtn.disabled = count === 0
  }

  function showError(message: string) {
    errorBar.textContent = message
    errorBar.style.display = 'block'
    toolbarHost.style.display = 'block'
    setTimeout(() => {
      errorBar.style.display = 'none'
      if (!active) toolbarHost.style.display = 'none'
    }, 5000)
  }

  function computeSelector(el: Element): string {
    // Try ID first
    if (el.id) {
      return `#${CSS.escape(el.id)}`
    }

    // Try unique class combination
    if (el.classList.length > 0) {
      const classSelector = Array.from(el.classList)
        .map(c => `.${CSS.escape(c)}`)
        .join('')
      const tagSelector = `${el.tagName.toLowerCase()}${classSelector}`
      if (document.querySelectorAll(tagSelector).length === 1) {
        return tagSelector
      }
    }

    // Structural path with nth-of-type
    const parts: string[] = []
    let current: Element | null = el
    while (current && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase()
      const parent = current.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
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

  function guessLabel(el: Element, preview: string): string {
    // aria-label
    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel) return ariaLabel.trim().substring(0, 60)

    // label[for]
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (label?.textContent) return label.textContent.trim().substring(0, 60)
    }

    // text preview
    if (preview.length > 0) return preview.substring(0, 60)

    // fallback
    selectionCount++
    return `Element ${selectionCount}`
  }

  function extractPreview(el: Element): string {
    return (el.textContent ?? '').trim().substring(0, 200)
  }

  function positionOverlay(overlay: HTMLElement, el: Element) {
    const rect = el.getBoundingClientRect()
    overlay.style.top = `${rect.top + window.scrollY}px`
    overlay.style.left = `${rect.left + window.scrollX}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`
  }

  function createSelectedOverlay(el: HTMLElement): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      border: 2px solid #059669;
      background: rgba(5, 150, 105, 0.08);
      border-radius: 3px;
      z-index: 2147483645;
    `
    positionOverlay(overlay, el)
    document.documentElement.appendChild(overlay)
    return overlay
  }

  function getSelectors(): SelectorEntry[] {
    return Array.from(selections.values()).map(s => s.selector)
  }

  function sendUpdate() {
    browser.runtime.sendMessage({
      action: MessageAction.ElementPickerUpdate,
      sessionId,
      selectors: getSelectors(),
    })
  }

  function sendComplete() {
    browser.runtime.sendMessage({
      action: MessageAction.ElementPickerComplete,
      sessionId,
      selectors: getSelectors(),
    })
    cleanup()
  }

  function sendCancel() {
    browser.runtime.sendMessage({
      action: MessageAction.ElementPickerCancel,
      sessionId,
    })
    cleanup()
  }

  function cleanup() {
    active = false
    hoverOverlay.style.display = 'none'
    toolbarHost.style.display = 'none'
    for (const {overlay} of selections.values()) {
      overlay.remove()
    }
    selections.clear()
    document.removeEventListener('mouseover', onMouseOver, true)
    document.removeEventListener('mouseout', onMouseOut, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKeyDown, true)
  }

  function isPickerUI(el: Element): boolean {
    return el === toolbarHost || el === hoverOverlay || toolbarHost.contains(el)
  }

  function onMouseOver(e: MouseEvent) {
    if (!active) return
    const target = e.target as HTMLElement
    if (isPickerUI(target)) return
    hoverOverlay.style.display = 'block'
    positionOverlay(hoverOverlay, target)
  }

  function onMouseOut(e: MouseEvent) {
    if (!active) return
    const target = e.target as HTMLElement
    if (isPickerUI(target)) return
    hoverOverlay.style.display = 'none'
  }

  function onClick(e: MouseEvent) {
    if (!active) return
    const target = e.target as HTMLElement
    if (isPickerUI(target)) return

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    if (selections.has(target)) {
      // Deselect
      const entry = selections.get(target)!
      entry.overlay.remove()
      selections.delete(target)
    } else {
      // Select
      const cssSelector = computeSelector(target)
      const preview = extractPreview(target)
      const label = guessLabel(target, preview)
      const overlay = createSelectedOverlay(target)

      selections.set(target, {
        overlay,
        selector: {
          label,
          cssSelector,
          extract: 'text_content',
          attributeName: '',
          preview,
        },
      })
    }

    updateToolbar()
    sendUpdate()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!active) return
    if (e.key === 'Escape') {
      e.preventDefault()
      sendCancel()
    }
  }

  function activate() {
    active = true
    toolbarHost.style.display = 'block'
    updateToolbar()
    document.addEventListener('mouseover', onMouseOver, true)
    document.addEventListener('mouseout', onMouseOut, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
  }

  // Toolbar button handlers
  doneBtn.addEventListener('click', () => {
    if (selections.size > 0) sendComplete()
  })

  cancelBtn.addEventListener('click', () => {
    sendCancel()
  })

  // Wait for StartElementPicker message to get sessionId and activate
  browser.runtime.onMessage.addListener((msg: unknown) => {
    const message = msg as {action: string; sessionId?: string; error?: string}
    if (message.action === MessageAction.StartElementPicker && message.sessionId) {
      sessionId = message.sessionId
      activate()
    } else if (message.action === MessageAction.ElementPickerError && message.error) {
      showError(message.error)
    }
  })
})()
