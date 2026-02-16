const NOISE_ATTRIBUTES = new Set(['class', 'style', 'id'])
const CONTENT_ATTRIBUTES = ['href', 'src', 'value', 'content', 'alt', 'title', 'datetime']

/**
 * Returns sorted, filtered attribute names for a single element.
 * Excludes noise attributes (class, style, id) and sorts by category:
 * data-* attributes first, then content attributes in priority order, then the rest.
 */
export function getElementAttributes(el: HTMLElement): string[] {
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

/**
 * Returns the unique set of available attributes across all elements,
 * maintaining the same sorting/grouping as getElementAttributes.
 *
 * This is important for advanced mode selectors that match multiple elements,
 * where different elements may have different attributes (e.g., data-price on
 * the first element and data-sku on the second).
 */
export function getAvailableAttributes(elements: HTMLElement[]): string[] {
  const seen = new Set<string>()
  const dataAttrs: string[] = []
  const contentAttrs: string[] = []
  const rest: string[] = []

  for (const el of elements) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name
      if (NOISE_ATTRIBUTES.has(name) || seen.has(name)) continue
      seen.add(name)

      if (name.startsWith('data-')) {
        dataAttrs.push(name)
      } else if (CONTENT_ATTRIBUTES.includes(name)) {
        contentAttrs.push(name)
      } else {
        rest.push(name)
      }
    }
  }

  dataAttrs.sort()
  contentAttrs.sort((a, b) => CONTENT_ATTRIBUTES.indexOf(a) - CONTENT_ATTRIBUTES.indexOf(b))
  rest.sort()

  return [...dataAttrs, ...contentAttrs, ...rest]
}
