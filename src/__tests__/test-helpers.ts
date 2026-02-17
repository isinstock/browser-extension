/**
 * Shared test helpers for jsdom-based tests.
 *
 * Import with: import {el, mount, polyfillCSSEscape} from './test-helpers'
 */

/**
 * Polyfills CSS.escape for jsdom environments where it's unavailable.
 * Call once at the top of any test file that uses CSS.escape.
 */
export function polyfillCSSEscape(): void {
  if (typeof globalThis.CSS === 'undefined') {
    ;(globalThis as any).CSS = {}
  }
  if (typeof CSS.escape !== 'function') {
    CSS.escape = (value: string) => value.replace(/([^\w-])/g, '\\$1')
  }
}

/**
 * Creates an HTMLElement with the given tag, attributes, and children.
 * Supports a special `textContent` attribute key that sets the element's text.
 */
export function el(tag: string, attrs: Record<string, string> = {}, children: HTMLElement[] = []): HTMLElement {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'textContent') {
      element.textContent = value
    } else {
      element.setAttribute(name, value)
    }
  }
  for (const child of children) {
    element.appendChild(child)
  }
  return element
}

/**
 * Appends the element to document.body so querySelectorAll works,
 * and returns a cleanup function.
 */
export function mount(element: HTMLElement): () => void {
  document.body.appendChild(element)
  return () => element.remove()
}
