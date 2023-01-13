// Fork of
// https://github.com/github/include-fragment-element/blob/main/src/index.ts

import '@webcomponents/custom-elements'
import {NearbyInventoryProductRequest, NearbyInventoryResponse} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'

class IsInStockButtonElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['request', 'loading']
  }

  get preload(): boolean {
    return this.hasAttribute('preload')
  }

  set preload(value: boolean) {
    if (value) {
      this.setAttribute('preload', '')
    } else {
      this.removeAttribute('preload')
    }
  }

  get loading(): 'eager' | 'lazy' {
    if (this.getAttribute('loading') === 'lazy') return 'lazy'
    return 'eager'
  }

  set loading(value: 'eager' | 'lazy') {
    this.setAttribute('loading', value)
  }

  #busy = false

  constructor() {
    super()

    this.addEventListener('nearby-inventory-response', ((event: CustomEvent) => {
      const json = event.detail.data as NearbyInventoryResponse
      this.#processInventoryResponse(json)
    }) as EventListener)
  }

  request(): Request {
    const body = this.dataset.request
    if (!body) {
      throw new Error('missing request')
    }

    return new Request('http://localhost:3000/extension/inventory/nearby', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    })
  }

  connectedCallback() {
    const shadowRoot = this.attachShadow({mode: 'open'})
    this.style.backgroundColor = '#fff'
    this.style.maxWidth = '500px'
    this.style.fontSize = '16px'
    this.style.display = 'block'
    const inventoryState = this.dataset.inventoryState as InventoryStateNormalized

    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = chrome.runtime.getURL('elements/isinstock-button/style.css')
    shadowRoot.appendChild(stylesheet)

    const details = document.createElement('details')
    details.role = 'dialog'
    details.ariaModal = 'true'

    const summary = document.createElement('summary')
    summary.ariaHasPopup = 'menu'
    summary.ariaExpanded = 'false'
    summary.role = 'button'
    summary.style.userSelect = 'none'
    details.appendChild(summary)

    const detailsMenu = document.createElement('details-menu')
    detailsMenu.role = 'menu'
    detailsMenu.innerHTML = 'Loading…'
    details.appendChild(detailsMenu)

    const image = document.createElement('img')
    image.classList.add('isinstock-logo')
    image.width = 16
    image.height = 16
    const span = document.createElement('span')
    span.classList.add('isinstock-button-label')
    switch (inventoryState) {
      case InventoryStateNormalized.Available:
        image.src = chrome.runtime.getURL('images/inventory-states/available/128.png')
        span.innerText = 'Checking nearby stores…'

        break

      case InventoryStateNormalized.Unavailable:
        image.src = chrome.runtime.getURL('images/inventory-states/unavailable/128.png')
        span.innerText = 'Checking nearby stores…'
        break

      default:
        image.src = chrome.runtime.getURL('images/inventory-states/unknown/128.png')
        span.innerText = 'Checking nearby stores…'
        break
    }

    summary.appendChild(image)
    summary.appendChild(span)

    shadowRoot.appendChild(details)

    if (this.dataset.request && this.loading === 'eager') {
      this.#handleData()
    }
    if (this.loading === 'lazy') {
      this.#observer.observe(this)
    }
    // .then((json: NearbyInventoryResponse) => this.processInventoryResponse(json))

    // const subscriptions = [
    //   fromEvent(details, 'compositionstart', e => trackComposition(this, e)),
    //   fromEvent(details, 'compositionend', e => trackComposition(this, e)),
    //   fromEvent(details, 'click', e => shouldCommit(details, e)),
    //   fromEvent(details, 'change', e => shouldCommit(details, e)),
    //   fromEvent(details, 'keydown', e => keydown(details, this, e)),
    //   fromEvent(details, 'toggle', () => loadFragment(details, this), {once: true}),
    //   fromEvent(details, 'toggle', () => closeCurrentMenu(details)),
    //   this.preload
    //     ? fromEvent(details, 'mouseover', () => loadFragment(details, this), {once: true})
    //     : NullSubscription,
    //   ...focusOnOpen(details)
    // ]

    // states.set(this, {subscriptions, loaded: false, isComposing: false})
  }

  #processInventoryResponse(json: NearbyInventoryResponse): void {
    const label = this.shadowRoot?.querySelector<HTMLSpanElement>('.isinstock-button-label')
    if (!label) {
      return
    }

    const states = json.skus.flatMap(sku => {
      return sku.locations.flatMap(location => {
        return location.inventoryCheck?.state
      })
    })
    // Check to see if its cheaper anywhere else

    const availableStates = states.filter(state => state === InventoryStateNormalized.Available)
    if (availableStates.length > 0) {
      label.innerText = `In stock at ${availableStates.length} locations near you`
    } else {
      label.innerText = 'Not in stock near you'
    }

    const detailsMenu = this.shadowRoot?.querySelector('details-menu')
    if (detailsMenu) {
      const innerDiv = document.createElement('div')
      innerDiv.classList.add('select-menu')

      json.skus.forEach(sku => {
        const retailer = document.createElement('h1')
        retailer.innerText = sku.retailer.name
        innerDiv.appendChild(retailer)

        const purchaseLink = document.createElement('a')
        purchaseLink.href = sku.url
        purchaseLink.innerText = 'Buy Now'
        innerDiv.appendChild(purchaseLink)

        const locationsUl = document.createElement('ul')
        sku.locations.forEach(location => {
          const row = document.createElement('li')

          if (location.inventoryCheck?.state == InventoryStateNormalized.Available) {
            const strong = document.createElement('strong')
            strong.innerText = location.name
            row.appendChild(strong)
          } else {
            row.innerText = location.name
          }
          locationsUl.appendChild(row)
        })
        innerDiv.appendChild(locationsUl)
      })

      detailsMenu.replaceChildren(innerDiv)
    }
  }

  disconnectedCallback(): void {
    const state = states.get(this)
    if (!state) return
    states.delete(this)
    for (const sub of state.subscriptions) {
      sub.unsubscribe()
    }
  }

  load(): Promise<string> {
    return this.#getStringOrErrorData()
  }

  fetch(request: RequestInfo): Promise<Response> {
    return fetch(request)
  }

  refetch() {
    this.#handleData()
  }

  #observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const {target} = entry
          this.#observer.unobserve(target)
          if (!(target instanceof IsInStockButtonElement)) return
          if (target.loading === 'lazy') {
            this.#handleData()
          }
        }
      }
    },
    {
      // Currently the threshold is set to 256px from the bottom of the viewport
      // with a threshold of 0.1. This means the element will not load until about
      // 2 keyboard-down-arrow presses away from being visible in the viewport,
      // giving us some time to fetch it before the contents are made visible
      rootMargin: '0px 0px 256px 0px',
      threshold: 0.01,
    },
  )

  async #getData(): Promise<NearbyInventoryResponse> {
    const request = this.dataset.request
    let data: Promise<NearbyInventoryResponse>
    if (request) {
      data = this.#fetchDataWithEvents()
    } else {
      data = Promise.reject(new Error('missing request'))
    }
    return data
  }

  async #getStringOrErrorData(): Promise<string> {
    const data = await this.#getData()
    if (data instanceof Error) {
      throw data
    }
    return data.toString()
  }

  async #handleData(): Promise<void> {
    if (this.#busy) return
    this.#busy = true
    try {
      const data = await this.#getData()
      if (data instanceof Error) {
        throw data
      }
      console.log(this)
      const canceled = !this.dispatchEvent(
        new CustomEvent('nearby-inventory-response', {cancelable: true, detail: {data}}),
      )
      if (canceled) {
        this.#busy = false
        return
      }

      //
      console.log('do custom logic here')
    } catch {
      this.classList.add('is-error')
    } finally {
      this.#busy = false
    }
  }

  // Functional stand in for the W3 spec "queue a task" paradigm
  async #task(eventsToDispatch: string[]): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0))
    for (const eventType of eventsToDispatch) {
      this.dispatchEvent(new Event(eventType))
    }
  }

  async #fetchDataWithEvents(): Promise<NearbyInventoryResponse> {
    // We mimic the same event order as <img>, including the spec
    // which states events must be dispatched after "queue a task".
    // https://www.w3.org/TR/html52/semantics-embedded-content.html#the-img-element
    try {
      await this.#task(['loadstart'])
      const response = await this.fetch(this.request())
      if (response.status !== 200) {
        throw new Error(`Failed to load resource: the server responded with a status of ${response.status}`)
      }

      const data: NearbyInventoryResponse = await response.json()

      // Dispatch `load` and `loadend` async to allow
      // the `load()` promise to resolve _before_ these
      // events are fired.
      this.#task(['load', 'loadend'])
      return data
    } catch (error) {
      // Dispatch `error` and `loadend` async to allow
      // the `load()` promise to resolve _before_ these
      // events are fired.
      this.#task(['error', 'loadend'])
      throw error
    }
  }
}

const states = new WeakMap()

type Subscription = {unsubscribe(): void}
const NullSubscription = {
  unsubscribe() {
    /* Do nothing */
  },
}

declare global {
  interface Window {
    IsInStockButtonElement: typeof IsInStockButtonElement
  }
  interface HTMLElementTagNameMap {
    'isinstock-button': IsInStockButtonElement
  }
}

if (!window.customElements.get('isinstock-button')) {
  window.IsInStockButtonElement = IsInStockButtonElement
  window.customElements.define('isinstock-button', IsInStockButtonElement)
}

interface InsertIsInStockButtonOptions {
  insertPosition?: InsertPosition
  inventoryState?: InventoryStateNormalized
  request: NearbyInventoryProductRequest
}

export function insertIsInStockButton(
  element: HTMLElement,
  {
    insertPosition = 'afterend',
    inventoryState = InventoryStateNormalized.Unknown,
    request,
  }: InsertIsInStockButtonOptions,
): IsInStockButtonElement {
  let existingButton = document.querySelector<IsInStockButtonElement>('isinstock-button')
  if (existingButton) {
    return existingButton
  }

  const button = document.createElement('isinstock-button')
  button.loading = 'lazy'
  button.dataset.inventoryState = inventoryState
  button.dataset.request = JSON.stringify(request)

  element.insertAdjacentElement(insertPosition, button)

  return button
}

function fromEvent(
  target: EventTarget,
  eventName: string,
  onNext: EventListenerOrEventListenerObject,
  options: boolean | AddEventListenerOptions = false,
): Subscription {
  target.addEventListener(eventName, onNext, options)
  return {
    unsubscribe: () => {
      target.removeEventListener(eventName, onNext, options)
    },
  }
}

function loadFragment(details: Element, menu: IsInStockButtonElement) {
  const src = menu.getAttribute('src')
  if (!src) return

  const state = states.get(menu)
  if (!state) return

  if (state.loaded) return
  state.loaded = true

  const loader = menu.querySelector('include-fragment')
  if (loader && !loader.hasAttribute('src')) {
    loader.addEventListener('loadend', () => autofocus(details))
    loader.setAttribute('src', src)
  }
}

function focusOnOpen(details: Element): Subscription[] {
  let isMouse = false
  const onmousedown = () => (isMouse = true)
  const onkeydown = () => (isMouse = false)
  const ontoggle = () => {
    if (!details.hasAttribute('open')) return
    if (autofocus(details)) return
    if (!isMouse) focusFirstItem(details)
  }

  return [
    fromEvent(details, 'mousedown', onmousedown),
    fromEvent(details, 'keydown', onkeydown),
    fromEvent(details, 'toggle', ontoggle),
  ]
}

function closeCurrentMenu(details: Element) {
  if (!details.hasAttribute('open')) return

  for (const menu of document.querySelectorAll('details[open] > details-menu')) {
    const opened = menu.closest('details')
    if (opened && opened !== details && !opened.contains(details)) {
      opened.removeAttribute('open')
    }
  }
}

function autofocus(details: Element): boolean {
  if (!details.hasAttribute('open')) return false
  const input = details.querySelector<HTMLElement>('details-menu [autofocus]')
  if (input) {
    input.focus()
    return true
  } else {
    return false
  }
}

// Focus first item unless an item is already focused.
function focusFirstItem(details: Element) {
  const selected = document.activeElement
  if (selected && isMenuItem(selected) && details.contains(selected)) return

  const target = sibling(details, true)
  if (target) target.focus()
}

function sibling(details: Element, next: boolean): HTMLElement | null {
  const options = Array.from(details.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([hidden]):not([disabled])'))
  const selected = document.activeElement
  const index = selected instanceof HTMLElement ? options.indexOf(selected) : -1
  const found = next ? options[index + 1] : options[index - 1]
  const def = next ? options[0] : options[options.length - 1]
  return found || def
}

const ctrlBindings = navigator.userAgent.match(/Macintosh/)

function shouldCommit(details: Element, event: Event) {
  const target = event.target
  if (!(target instanceof Element)) return

  // Ignore clicks from nested details.
  if (target.closest('details') !== details) return

  if (event.type === 'click') {
    const menuitem = target.closest('[role="menuitem"], [role="menuitemradio"]')
    if (!menuitem) return

    const input = menuitem.querySelector('input')

    // Ignore double event caused by inputs nested in labels
    // Known issue: This will wrongly ignore a legit click event on an already checked input,
    // but inputs are not expected to be visible in the menu items.
    // I've found no way to discriminate the legit event from the echo one, and we don't want to trigger the selected event twice.
    if (menuitem.tagName === 'LABEL' && target === input) return

    // An input inside a label will be committed as a change event (we assume it's a radio input),
    // unless the input is already checked, so we need to commit on click (to close the popup)
    const onlyCommitOnChangeEvent = menuitem.tagName === 'LABEL' && input && !input.checked
    if (!onlyCommitOnChangeEvent) {
      commit(menuitem, details)
    }
  } else if (event.type === 'change') {
    const menuitem = target.closest('[role="menuitemradio"], [role="menuitemcheckbox"]')
    if (menuitem) commit(menuitem, details)
  }
}

function updateChecked(selected: Element, details: Element) {
  for (const el of details.querySelectorAll('[role="menuitemradio"], [role="menuitemcheckbox"]')) {
    const input = el.querySelector('input[type="radio"], input[type="checkbox"]')
    let checkState = (el === selected).toString()
    if (input instanceof HTMLInputElement) {
      checkState = input.indeterminate ? 'mixed' : input.checked.toString()
    }
    el.setAttribute('aria-checked', checkState)
  }
}

function commit(selected: Element, details: Element) {
  if (selected.hasAttribute('disabled') || selected.getAttribute('aria-disabled') === 'true') return
  const menu = selected.closest('details-menu')
  if (!menu) return

  const dispatched = menu.dispatchEvent(
    new CustomEvent('details-menu-select', {
      cancelable: true,
      detail: {relatedTarget: selected},
    }),
  )
  if (!dispatched) return

  updateLabel(selected, details)
  updateChecked(selected, details)
  if (selected.getAttribute('role') !== 'menuitemcheckbox') close(details)
  menu.dispatchEvent(
    new CustomEvent('details-menu-selected', {
      detail: {relatedTarget: selected},
    }),
  )
}

function keydown(details: Element, menu: IsInStockButtonElement, event: Event) {
  if (!(event instanceof KeyboardEvent)) return
  // Ignore key presses from nested details.
  if (details.querySelector('details[open]')) return
  const state = states.get(menu)
  if (!state || state.isComposing) return

  const isSummaryFocused = event.target instanceof Element && event.target.tagName === 'SUMMARY'

  switch (event.key) {
    case 'Escape':
      if (details.hasAttribute('open')) {
        close(details)
        event.preventDefault()
        event.stopPropagation()
      }
      break
    case 'ArrowDown':
      {
        if (isSummaryFocused && !details.hasAttribute('open')) {
          details.setAttribute('open', '')
        }
        const target = sibling(details, true)
        if (target) target.focus()
        event.preventDefault()
      }
      break
    case 'ArrowUp':
      {
        if (isSummaryFocused && !details.hasAttribute('open')) {
          details.setAttribute('open', '')
        }
        const target = sibling(details, false)
        if (target) target.focus()
        event.preventDefault()
      }
      break
    case 'n':
      {
        if (ctrlBindings && event.ctrlKey) {
          const target = sibling(details, true)
          if (target) target.focus()
          event.preventDefault()
        }
      }
      break
    case 'p':
      {
        if (ctrlBindings && event.ctrlKey) {
          const target = sibling(details, false)
          if (target) target.focus()
          event.preventDefault()
        }
      }
      break
    case ' ':
    case 'Enter':
      {
        const selected = document.activeElement
        if (selected instanceof HTMLElement && isMenuItem(selected) && selected.closest('details') === details) {
          event.preventDefault()
          event.stopPropagation()
          selected.click()
        }
      }
      break
  }
}

function isMenuItem(el: Element): boolean {
  const role = el.getAttribute('role')
  return role === 'menuitem' || role === 'menuitemcheckbox' || role === 'menuitemradio'
}

function close(details: Element) {
  const wasOpen = details.hasAttribute('open')
  if (!wasOpen) return
  details.removeAttribute('open')
  const summary = details.querySelector('summary')
  if (summary) summary.focus()
}

function updateLabel(item: Element, details: Element) {
  const button = details.querySelector('[data-menu-button]')
  if (!button) return

  const text = labelText(item)
  if (text) {
    button.textContent = text
  } else {
    const html = labelHTML(item)
    if (html) button.innerHTML = html
  }
}

function labelText(el: Element | null): string | null {
  if (!el) return null
  const textEl = el.hasAttribute('data-menu-button-text') ? el : el.querySelector('[data-menu-button-text]')

  if (!textEl) return null
  return textEl.getAttribute('data-menu-button-text') || textEl.textContent
}

function labelHTML(el: Element | null): string | null {
  if (!el) return null
  const contentsEl = el.hasAttribute('data-menu-button-contents') ? el : el.querySelector('[data-menu-button-contents]')

  return contentsEl ? contentsEl.innerHTML : null
}

function trackComposition(menu: Element, event: Event) {
  const state = states.get(menu)
  if (!state) return
  state.isComposing = event.type === 'compositionstart'
}
