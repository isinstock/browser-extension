import type {ClassFrequencyCache} from './class-frequency-cache'
import {TEST_ID_ATTRIBUTES} from './test-id-attributes'
import {getTestIdSelector} from './test-id-attributes'

declare const __DEV__: boolean

export interface SelectorTraceCandidate {
  name: string
  count: number
}

export interface SelectorTrace {
  tag: string
  id: string | null
  classes: string[]
  testIdAttrs: {name: string; value: string}[]
  candidates: SelectorTraceCandidate[]
  strategy: 'test-id' | 'id' | 'single-class' | 'class-combination' | 'structural'
  result: string
  kept: string[]
  dropped: SelectorTraceCandidate[]
}

/** Last evaluation trace — updated on every computeSelector call. */
export let lastTrace: SelectorTrace | null = null

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
  lastTrace = null

  // Collect element info for trace
  const elTag = el.tagName.toLowerCase()
  const elId = el.id || null
  const elClasses = Array.from(el.classList)
  const elTestIdAttrs: {name: string; value: string}[] = []
  for (const attr of TEST_ID_ATTRIBUTES) {
    const value = el.getAttribute(attr)
    if (value) elTestIdAttrs.push({name: attr, value})
  }

  // Prefer test ID attributes — they're stable, developer-intentional identifiers
  const testIdSelector = getTestIdSelector(el)
  if (testIdSelector && document.querySelectorAll(testIdSelector).length === 1) {
    lastTrace = {
      tag: elTag,
      id: elId,
      classes: elClasses,
      testIdAttrs: elTestIdAttrs,
      candidates: [],
      strategy: 'test-id',
      result: testIdSelector,
      kept: [],
      dropped: [],
    }
    return testIdSelector
  }

  if (el.id) {
    const selector = `#${CSS.escape(el.id)}`
    lastTrace = {
      tag: elTag,
      id: elId,
      classes: elClasses,
      testIdAttrs: elTestIdAttrs,
      candidates: [],
      strategy: 'id',
      result: selector,
      kept: [],
      dropped: [],
    }
    return selector
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

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug(
        `[selector] Evaluating ${classes.length} classes on <${tag}>`,
        scored.map(s => `${s.name}(${s.count})`).join(', '),
      )
    }

    // Try single classes first — if tag.class is unique, that's the best selector
    for (const s of scored) {
      if (s.count === 1) {
        const selector = `${tag}.${CSS.escape(s.name)}`
        const dropped = scored.filter(x => x !== s)
        lastTrace = {
          tag,
          id: elId,
          classes: elClasses,
          testIdAttrs: elTestIdAttrs,
          candidates: [...scored],
          strategy: 'single-class',
          result: selector,
          kept: [s.name],
          dropped,
        }
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.debug(
            `[selector] Result: ${selector}`,
            dropped.length > 0
              ? `| Dropped: ${dropped.map(d => `${d.name}(${d.count})`).join(', ')}`
              : '',
          )
        }
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
        lastTrace = {
          tag,
          id: elId,
          classes: elClasses,
          testIdAttrs: elTestIdAttrs,
          candidates: [...scored],
          strategy: 'class-combination',
          result: selector,
          kept: [...used],
          dropped,
        }
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.debug(
            `[selector] Result: ${selector} (${used.length} classes)`,
            dropped.length > 0
              ? `| Dropped: ${dropped.map(d => `${d.name}(${d.count})`).join(', ')}`
              : '',
          )
        }
        return selector
      }
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug(`[selector] No unique class combination found, falling back to structural path`)
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

  const result = parts.join(' > ')
  lastTrace = {
    tag: elTag,
    id: elId,
    classes: elClasses,
    testIdAttrs: elTestIdAttrs,
    candidates: [],
    strategy: 'structural',
    result,
    kept: [],
    dropped: [],
  }
  return result
}
