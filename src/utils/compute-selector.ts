import type {ClassFrequencyCache} from './class-frequency-cache'
import {getTestIdSelector} from './test-id-attributes'

/**
 * Computes a CSS selector that uniquely identifies the given element on the page.
 *
 * Strategies tried in order:
 * 1. Test ID attribute (e.g. [data-testid="product-card"]) — if unique on page
 * 2. #id
 * 3. tag.class — scored by frequency, minimal classes needed for uniqueness
 * 4. Structural path: tag:nth-of-type(n) > ... up to <html>
 *
 * When a ClassFrequencyCache is provided, class evaluation uses pre-computed
 * counts instead of per-class DOM queries.
 */
export function computeSelector(el: Element, cache?: ClassFrequencyCache): string {
  // Prefer test ID attributes — they're stable, developer-intentional identifiers
  const testIdSelector = getTestIdSelector(el)
  if (testIdSelector && document.querySelectorAll(testIdSelector).length === 1) {
    return testIdSelector
  }

  if (el.id) {
    return `#${CSS.escape(el.id)}`
  }

  if (el.classList.length > 0) {
    const tag = el.tagName.toLowerCase()
    const classes = Array.from(el.classList)

    // Score each class by how many elements on the page match tag.class
    const scored = classes.map(cls => {
      const count = cache
        ? cache.tagClassCount(tag, cls)
        : document.querySelectorAll(`${tag}.${CSS.escape(cls)}`).length
      return {name: cls, count}
    })

    // Sort by frequency ascending — most specific (fewest matches) first
    scored.sort((a, b) => a.count - b.count)

    console.debug(
      `[selector] Evaluating ${classes.length} classes on <${tag}>`,
      scored.map(s => `${s.name}(${s.count})`).join(', '),
    )

    // Try single classes first — if tag.class is unique, that's the best selector
    for (const s of scored) {
      if (s.count === 1) {
        const selector = `${tag}.${CSS.escape(s.name)}`
        const dropped = scored.filter(x => x !== s)
        console.debug(
          `[selector] Result: ${selector}`,
          dropped.length > 0
            ? `| Dropped: ${dropped.map(d => `${d.name}(${d.count})`).join(', ')}`
            : '',
        )
        return selector
      }
    }

    // Build minimal combination — start with most specific, add until unique
    const used: string[] = []
    for (const s of scored) {
      used.push(s.name)
      const selector = `${tag}${used.map(c => `.${CSS.escape(c)}`).join('')}`
      const matchCount = document.querySelectorAll(selector).length
      if (matchCount === 1) {
        const dropped = scored.filter(x => !used.includes(x.name))
        console.debug(
          `[selector] Result: ${selector} (${used.length} classes)`,
          dropped.length > 0
            ? `| Dropped: ${dropped.map(d => `${d.name}(${d.count})`).join(', ')}`
            : '',
        )
        return selector
      }
    }

    console.debug(`[selector] No unique class combination found, falling back to structural path`)
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
