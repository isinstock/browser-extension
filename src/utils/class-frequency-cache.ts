/**
 * Pre-built cache of class frequency counts across the entire page.
 *
 * Built once via a single DOM traversal of all elements, then used by
 * computeSelector to score and rank classes without per-class DOM queries.
 */

export interface ClassFrequencyCache {
  /** Number of elements on the page that have this class. */
  classCount(className: string): number

  /** Number of elements matching `tag.className` on the page. */
  tagClassCount(tag: string, className: string): number
}

/**
 * Scans every element on the page once and builds frequency maps for:
 * - `.className` → count of elements with that class
 * - `tag.className` → count of elements matching that tag+class combo
 *
 * This avoids repeated querySelectorAll calls when evaluating individual
 * classes during selector computation.
 */
export function buildClassFrequencyCache(): ClassFrequencyCache {
  const classCounts = new Map<string, number>()
  const tagClassCounts = new Map<string, number>()

  const allElements = document.querySelectorAll('[class]')
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]!
    const tag = el.tagName.toLowerCase()
    const classList = el.classList
    for (let j = 0; j < classList.length; j++) {
      const cls = classList[j]!
      classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1)
      const key = `${tag}\t${cls}`
      tagClassCounts.set(key, (tagClassCounts.get(key) ?? 0) + 1)
    }
  }

  return {
    classCount(className: string): number {
      return classCounts.get(className) ?? 0
    },
    tagClassCount(tag: string, className: string): number {
      return tagClassCounts.get(`${tag}\t${className}`) ?? 0
    },
  }
}
