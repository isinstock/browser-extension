import type {ClassFrequencyCache} from './class-frequency-cache'
import {classifyClass, type ClassType} from './class-classification'
import {TEST_ID_ATTRIBUTES} from './test-id-attributes'
import {getTestIdSelector} from './test-id-attributes'

declare const __DEV__: boolean

export interface SelectorTraceCandidate {
  name: string
  count: number
  classification: ClassType
}

export interface SelectorTrace {
  tag: string
  id: string | null
  classes: string[]
  testIdAttrs: {name: string; value: string}[]
  candidates: SelectorTraceCandidate[]
  strategy:
    | 'test-id'
    | 'id'
    | 'single-class'
    | 'semantic-combination'
    | 'parent-context'
    | 'class-combination'
    | 'structural'
  result: string
  kept: string[]
  dropped: SelectorTraceCandidate[]
}

/** Last evaluation trace — updated on every computeSelector call. */
export let lastTrace: SelectorTrace | null = null

/**
 * Try to build a unique selector using the parent's ID or semantic class.
 * Returns `parentSelector > tag` if it uniquely identifies the element, or null.
 */
function tryParentContext(el: Element, tag: string): string | null {
  const parent = el.parentElement
  if (!parent || parent === document.documentElement) return null

  // Try parent ID first
  if (parent.id) {
    const selector = `#${CSS.escape(parent.id)} > ${tag}`
    if (document.querySelectorAll(selector).length === 1) return selector
  }

  // Try parent tag + semantic class
  const parentTag = parent.tagName.toLowerCase()
  const parentClasses = Array.from(parent.classList)
  for (const cls of parentClasses) {
    if (classifyClass(cls) === 'semantic') {
      const selector = `${parentTag}.${CSS.escape(cls)} > ${tag}`
      if (document.querySelectorAll(selector).length === 1) return selector
    }
  }

  return null
}

/**
 * Build a minimal class combination from the given scored list that produces
 * a unique selector. Returns the selector string or null.
 */
function tryMinimalCombination(
  tag: string,
  scored: {name: string; count: number; classification: ClassType}[],
): string | null {
  const used: string[] = []
  for (const s of scored) {
    used.push(s.name)
    const selector = `${tag}${used.map(c => `.${CSS.escape(c)}`).join('')}`
    if (document.querySelectorAll(selector).length === 1) return selector
  }
  return null
}

/**
 * Computes a CSS selector that uniquely identifies the given element on the page.
 *
 * Strategies tried in order:
 * 1. Test ID attribute (e.g. [data-testid="product-card"]) — if unique on page
 * 2. #id — verified unique via querySelectorAll
 * 3. Class evaluation with utility classification:
 *    a. Score & classify all classes (semantic / utility / hashed)
 *    b. Unique semantic classes → keep all, return
 *    c. Semantic-only combination → build minimal combo from semantic classes
 *    d. Parent-context → try `#parentId > tag` or `parentTag.semanticClass > tag`
 *    e. Unique utility classes → keep all, return
 *    f. All-class combination → build minimal combo from all classes
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

  // --- Strategy 1: Test ID attribute ---
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

  // --- Strategy 2: #id — verified unique ---
  if (el.id) {
    const selector = `#${CSS.escape(el.id)}`
    if (document.querySelectorAll(selector).length === 1) {
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
    // Duplicate ID — fall through to class strategies
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug(`[selector] Duplicate ID "${el.id}", falling through to class strategy`)
    }
  }

  // --- Strategy 3: Class evaluation with utility classification ---
  if (el.classList.length > 0) {
    const tag = el.tagName.toLowerCase()
    const classes = Array.from(el.classList)

    // 3a. Score & classify each class
    const scored: SelectorTraceCandidate[] = classes.map(cls => {
      const count = cache
        ? cache.tagClassCount(tag, cls)
        : document.querySelectorAll(`${tag}.${CSS.escape(cls)}`).length
      return {name: cls, count, classification: classifyClass(cls)}
    })

    // Sort: semantic first (by count asc), then utility (by count asc), then hashed (by count asc)
    const classOrder: Record<ClassType, number> = {semantic: 0, utility: 1, hashed: 2}
    scored.sort((a, b) => {
      const typeOrd = classOrder[a.classification] - classOrder[b.classification]
      if (typeOrd !== 0) return typeOrd
      return a.count - b.count
    })

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug(
        `[selector] Evaluating ${classes.length} classes on <${tag}>`,
        scored.map(s => `${s.name}(${s.count},${s.classification})`).join(', '),
      )
    }

    const semantic = scored.filter(s => s.classification === 'semantic')
    const utility = scored.filter(s => s.classification === 'utility')

    // Helper to build a trace result
    const makeTrace = (
      strategy: SelectorTrace['strategy'],
      result: string,
      kept: string[],
    ): SelectorTrace => ({
      tag,
      id: elId,
      classes: elClasses,
      testIdAttrs: elTestIdAttrs,
      candidates: [...scored],
      strategy,
      result,
      kept,
      dropped: scored.filter(s => !kept.includes(s.name)),
    })

    // 3b. Unique semantic classes (count === 1)
    const uniqueSemantic = semantic.filter(s => s.count === 1)
    if (uniqueSemantic.length > 0) {
      const selector = `${tag}${uniqueSemantic.map(s => `.${CSS.escape(s.name)}`).join('')}`
      const kept = uniqueSemantic.map(s => s.name)
      lastTrace = makeTrace('single-class', selector, kept)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.debug(`[selector] Result: ${selector} (unique semantic)`)
      }
      return selector
    }

    // 3c. Semantic-only combination
    if (semantic.length > 0) {
      const combo = tryMinimalCombination(tag, semantic)
      if (combo) {
        // Extract which classes were used from the selector
        const kept = semantic.filter(s => combo.includes(`.${CSS.escape(s.name)}`)).map(s => s.name)
        lastTrace = makeTrace('semantic-combination', combo, kept)
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.debug(`[selector] Result: ${combo} (semantic combination)`)
        }
        return combo
      }
    }

    // 3d. Parent-context
    const parentSel = tryParentContext(el, tag)
    if (parentSel) {
      lastTrace = makeTrace('parent-context', parentSel, [])
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.debug(`[selector] Result: ${parentSel} (parent context)`)
      }
      return parentSel
    }

    // 3e. Unique utility classes (count === 1)
    const uniqueUtility = utility.filter(s => s.count === 1)
    if (uniqueUtility.length > 0) {
      const selector = `${tag}${uniqueUtility.map(s => `.${CSS.escape(s.name)}`).join('')}`
      const kept = uniqueUtility.map(s => s.name)
      lastTrace = makeTrace('single-class', selector, kept)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.debug(`[selector] Result: ${selector} (unique utility)`)
      }
      return selector
    }

    // 3f. All-class combination (all types)
    const allCombo = tryMinimalCombination(tag, scored)
    if (allCombo) {
      const kept = scored.filter(s => allCombo.includes(`.${CSS.escape(s.name)}`)).map(s => s.name)
      lastTrace = makeTrace('class-combination', allCombo, kept)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.debug(`[selector] Result: ${allCombo} (all-class combination)`)
      }
      return allCombo
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug(`[selector] No unique class combination found, falling back to structural path`)
    }
  }

  // --- Strategy 4: Structural path ---
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
