import {TEST_ID_ATTRIBUTES} from './test-id-attributes'

const MAX_ANCESTOR_LEVELS = 5

export interface CollectionResult {
  selector: string
  elements: HTMLElement[]
}

export interface CollectionTraceLevel {
  level: number
  tag: string
  parentTag: string
  siblingCount: number
  strategy: string | null
  selector: string | null
  matchCount: number | null
}

export interface CollectionTrace {
  targetTag: string
  targetClasses: string[]
  levels: CollectionTraceLevel[]
  result: 'matched' | 'no-match'
  matchedVia: string | null
  matchedSelector: string | null
  matchedCount: number | null
}

/** Last collection evaluation trace — updated on every findCollection call. */
export let lastCollectionTrace: CollectionTrace | null = null

/**
 * Returns the sorted intersection of class lists across all elements.
 * Only classes present on every element are included.
 */
export function getSharedClasses(elements: HTMLElement[]): string[] {
  if (elements.length === 0) return []

  let shared: Set<string> | null = null
  for (const el of elements) {
    const classes = new Set(el.classList)
    if (shared === null) {
      shared = classes
    } else {
      for (const c of shared) {
        if (!classes.has(c)) shared.delete(c)
      }
    }
  }

  return shared ? Array.from(shared).sort() : []
}

/**
 * Returns same-tag sibling HTMLElements under the given parent.
 */
function getSameTagSiblings(element: HTMLElement, parent: Element): HTMLElement[] {
  const tag = element.tagName
  return toHTMLElements(Array.from(parent.children).filter(c => c.tagName === tag))
}

/**
 * Filters an Element array to only HTMLElement instances.
 */
function toHTMLElements(elements: Element[]): HTMLElement[] {
  return elements.filter((e): e is HTMLElement => e instanceof HTMLElement)
}

/**
 * Computes a selector that uniquely identifies the given parent element on the page.
 * Returns null if no unique selector can be built.
 *
 * Strategies tried in order:
 * 1. #id (if parent has an id)
 * 2. tag.class1.class2 (all classes combined, if unique)
 * 3. tag.class (individual classes, if any single one is unique)
 * 4. tag (if unique on page)
 */
function computeParentSelector(parent: Element): string | null {
  if (parent.id) {
    return `#${CSS.escape(parent.id)}`
  }

  const tag = parent.tagName.toLowerCase()

  if (parent.classList.length > 0) {
    const allClasses = Array.from(parent.classList)
      .map(c => `.${CSS.escape(c)}`)
      .join('')
    const combinedSelector = `${tag}${allClasses}`
    if (document.querySelectorAll(combinedSelector).length === 1) {
      return combinedSelector
    }

    for (const cls of parent.classList) {
      const singleSelector = `${tag}.${CSS.escape(cls)}`
      if (document.querySelectorAll(singleSelector).length === 1) {
        return singleSelector
      }
    }
  }

  if (document.querySelectorAll(tag).length === 1) {
    return tag
  }

  return null
}

/**
 * Finds the first test ID attribute name shared by ALL elements.
 * Returns the attribute name (e.g. "data-testid") or null.
 */
function getSharedTestIdAttribute(elements: HTMLElement[]): string | null {
  if (elements.length === 0) return null

  for (const attr of TEST_ID_ATTRIBUTES) {
    if (elements.every(el => el.hasAttribute(attr))) {
      return attr
    }
  }
  return null
}

/**
 * Tries to build a collection selector using shared test ID attributes (Strategy 0).
 *
 * When all siblings share the same test ID attribute name (e.g. data-testid),
 * tries `tag[attr]` globally first, then `[attr]` globally.
 * Falls back to parent-scoped `parentSelector > tag[attr]` if global matches too many.
 */
function tryTestIdSelector(
  tag: string,
  siblings: HTMLElement[],
  parent: Element,
  target: HTMLElement,
): CollectionResult | null {
  const sharedAttr = getSharedTestIdAttribute(siblings)

  if (sharedAttr) {
    // Try tag[attr] globally
    const tagAttrSelector = `${tag}[${sharedAttr}]`
    const tagAttrMatched = toHTMLElements(Array.from(document.querySelectorAll(tagAttrSelector)))
    if (tagAttrMatched.length === siblings.length) {
      return {selector: tagAttrSelector, elements: tagAttrMatched}
    }

    // Try [attr] globally (without tag)
    const attrSelector = `[${sharedAttr}]`
    const attrMatched = toHTMLElements(Array.from(document.querySelectorAll(attrSelector)))
    if (attrMatched.length === siblings.length) {
      return {selector: attrSelector, elements: attrMatched}
    }

    // Fall back to parent-scoped tag[attr]
    const parentSelector = computeParentSelector(parent)
    if (parentSelector) {
      const scopedSelector = `${parentSelector} > ${tag}[${sharedAttr}]`
      const scopedMatched = toHTMLElements(Array.from(document.querySelectorAll(scopedSelector)))
      if (scopedMatched.length === siblings.length) {
        return {selector: scopedSelector, elements: scopedMatched}
      }
    }
  }

  // Check if target has a test ID that identifies a subset of siblings
  for (const attr of TEST_ID_ATTRIBUTES) {
    const value = target.getAttribute(attr)
    if (!value) continue

    const exactSelector = `${tag}[${attr}="${CSS.escape(value)}"]`
    const exactMatched = toHTMLElements(Array.from(document.querySelectorAll(exactSelector)))
    if (exactMatched.length > 1 && exactMatched.includes(target)) {
      return {selector: exactSelector, elements: exactMatched}
    }
  }

  return null
}

/**
 * Tries to build a collection selector using global selectors (Strategy 1).
 * Tests shared classes first, then target-specific classes for subset matching.
 */
function tryGlobalSelector(tag: string, siblings: HTMLElement[], target: HTMLElement): CollectionResult | null {
  const sharedClasses = getSharedClasses(siblings)

  console.debug(
    `[collection]   Global strategy: ${sharedClasses.length} shared classes [${sharedClasses.join(', ')}], need exactly ${siblings.length} matches`,
  )

  // Try each shared class individually as tag.class
  for (const cls of sharedClasses) {
    const selector = `${tag}.${CSS.escape(cls)}`
    const matched = toHTMLElements(Array.from(document.querySelectorAll(selector)))
    console.debug(`[collection]   Tried ${selector} → ${matched.length} matches (need ${siblings.length})`)
    if (matched.length === siblings.length) {
      return {selector, elements: matched}
    }
  }

  // Try all shared classes combined
  if (sharedClasses.length > 1) {
    const selector = `${tag}${sharedClasses.map(c => `.${CSS.escape(c)}`).join('')}`
    const matched = toHTMLElements(Array.from(document.querySelectorAll(selector)))
    console.debug(`[collection]   Tried combined ${selector} → ${matched.length} matches (need ${siblings.length})`)
    if (matched.length === siblings.length) {
      return {selector, elements: matched}
    }
  }

  // Try target's own classes for subset detection (handles mixed children)
  // e.g. parent has [li.product, li.product, li.separator] — target has class "product"
  const targetClasses = Array.from(target.classList).sort()
  for (const cls of targetClasses) {
    if (sharedClasses.includes(cls)) continue // already tried above
    const selector = `${tag}.${CSS.escape(cls)}`
    const matched = toHTMLElements(Array.from(document.querySelectorAll(selector)))
    console.debug(`[collection]   Tried target-specific ${selector} → ${matched.length} matches (need >1, includes target: ${matched.includes(target)})`)
    if (matched.length > 1 && matched.includes(target)) {
      return {selector, elements: matched}
    }
  }

  return null
}

/**
 * Tries to build a collection selector using parent-scoped selectors (Strategy 2).
 */
function tryParentScopedSelector(
  tag: string,
  siblings: HTMLElement[],
  parent: Element,
  target: HTMLElement,
): CollectionResult | null {
  const parentSelector = computeParentSelector(parent)
  if (!parentSelector) return null

  const sharedClasses = getSharedClasses(siblings)

  // Try parent > tag.class for each shared class
  for (const cls of sharedClasses) {
    const selector = `${parentSelector} > ${tag}.${CSS.escape(cls)}`
    const matched = toHTMLElements(Array.from(document.querySelectorAll(selector)))
    if (matched.length === siblings.length) {
      return {selector, elements: matched}
    }
  }

  // Try parent > tag.class for target's own classes (subset)
  const targetClasses = Array.from(target.classList).sort()
  for (const cls of targetClasses) {
    if (sharedClasses.includes(cls)) continue
    const selector = `${parentSelector} > ${tag}.${CSS.escape(cls)}`
    const matched = toHTMLElements(Array.from(document.querySelectorAll(selector)))
    if (matched.length > 1 && matched.includes(target)) {
      return {selector, elements: matched}
    }
  }

  // Fallback: parent > tag (all same-tag children)
  const selector = `${parentSelector} > ${tag}`
  const matched = toHTMLElements(Array.from(document.querySelectorAll(selector)))
  if (matched.length >= 2 && matched.includes(target)) {
    return {selector, elements: matched}
  }

  return null
}

/**
 * Finds a collection of similar elements given a target element.
 *
 * Walks up the DOM tree from the target (max 5 ancestor levels), looking for
 * same-tag siblings at each level. When found, attempts to build the simplest
 * CSS selector that identifies the group.
 *
 * Strategies tried at each level (in order):
 * 0. Test ID selectors: tag[data-testid] or [data-testid] (if siblings share a test ID attr)
 * 1. Global selectors: tag.sharedClass (if globally unique to the group)
 * 2. Parent-scoped selectors: parentSelector > tag.class or parentSelector > tag
 * 3. Continue walking up if no selector found
 *
 * Returns the first successful match (nearest/most specific collection),
 * or null if no collection can be identified.
 */
export function findCollection(target: HTMLElement): CollectionResult | null {
  let current: HTMLElement = target
  let level = 0

  const trace: CollectionTrace = {
    targetTag: target.tagName.toLowerCase(),
    targetClasses: Array.from(target.classList),
    levels: [],
    result: 'no-match',
    matchedVia: null,
    matchedSelector: null,
    matchedCount: null,
  }
  lastCollectionTrace = trace

  console.debug(`[collection] Starting from <${trace.targetTag}>, classes: [${trace.targetClasses.join(', ')}]`)

  while (level < MAX_ANCESTOR_LEVELS) {
    const parent = current.parentElement
    if (!parent || parent === document.documentElement) {
      console.debug(`[collection] Level ${level}: hit document boundary, stopping`)
      trace.levels.push({level, tag: current.tagName.toLowerCase(), parentTag: '(boundary)', siblingCount: 0, strategy: null, selector: null, matchCount: null})
      break
    }

    const siblings = getSameTagSiblings(current, parent)
    const tag = current.tagName.toLowerCase()
    const parentTag = parent.tagName.toLowerCase()

    console.debug(
      `[collection] Level ${level}: <${tag}> has ${siblings.length} same-tag siblings under <${parentTag}>`,
    )

    if (siblings.length >= 2) {
      // Strategy 0: Test ID attribute selectors
      const testIdResult = tryTestIdSelector(tag, siblings, parent, target)
      if (testIdResult) {
        console.debug(`[collection] Matched via test ID: ${testIdResult.selector} (${testIdResult.elements.length} elements)`)
        trace.levels.push({level, tag, parentTag, siblingCount: siblings.length, strategy: 'test-id', selector: testIdResult.selector, matchCount: testIdResult.elements.length})
        trace.result = 'matched'
        trace.matchedVia = 'test-id'
        trace.matchedSelector = testIdResult.selector
        trace.matchedCount = testIdResult.elements.length
        return testIdResult
      }

      // Strategy 1: Global selectors
      const globalResult = tryGlobalSelector(tag, siblings, target)
      if (globalResult) {
        console.debug(`[collection] Matched via global: ${globalResult.selector} (${globalResult.elements.length} elements)`)
        trace.levels.push({level, tag, parentTag, siblingCount: siblings.length, strategy: 'global', selector: globalResult.selector, matchCount: globalResult.elements.length})
        trace.result = 'matched'
        trace.matchedVia = 'global'
        trace.matchedSelector = globalResult.selector
        trace.matchedCount = globalResult.elements.length
        return globalResult
      }

      // Strategy 2: Parent-scoped selectors
      const scopedResult = tryParentScopedSelector(tag, siblings, parent, target)
      if (scopedResult) {
        console.debug(`[collection] Matched via parent-scoped: ${scopedResult.selector} (${scopedResult.elements.length} elements)`)
        trace.levels.push({level, tag, parentTag, siblingCount: siblings.length, strategy: 'parent-scoped', selector: scopedResult.selector, matchCount: scopedResult.elements.length})
        trace.result = 'matched'
        trace.matchedVia = 'parent-scoped'
        trace.matchedSelector = scopedResult.selector
        trace.matchedCount = scopedResult.elements.length
        return scopedResult
      }

      console.debug(`[collection] Level ${level}: no strategy matched for ${siblings.length} <${tag}> siblings`)
      trace.levels.push({level, tag, parentTag, siblingCount: siblings.length, strategy: null, selector: null, matchCount: null})
    } else {
      trace.levels.push({level, tag, parentTag, siblingCount: siblings.length, strategy: null, selector: null, matchCount: null})
    }

    current = parent as HTMLElement
    level++
  }

  console.debug(`[collection] No collection found after ${level} levels`)
  return null
}
