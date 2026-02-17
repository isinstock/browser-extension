import {getTestIdSelector} from './test-id-attributes'

/**
 * Computes a CSS selector that uniquely identifies the given element on the page.
 *
 * Strategies tried in order:
 * 1. Test ID attribute (e.g. [data-testid="product-card"]) — if unique on page
 * 2. #id
 * 3. tag.class1.class2 — if unique on page
 * 4. Structural path: tag:nth-of-type(n) > ... up to <html>
 */
export function computeSelector(el: Element): string {
  // Prefer test ID attributes — they're stable, developer-intentional identifiers
  const testIdSelector = getTestIdSelector(el)
  if (testIdSelector && document.querySelectorAll(testIdSelector).length === 1) {
    return testIdSelector
  }

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
