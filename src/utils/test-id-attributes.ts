/**
 * Common test ID attributes used by popular testing frameworks.
 * Ordered by prevalence — first match wins.
 *
 * These are explicitly placed by developers as stable element identifiers,
 * making them more reliable selectors than class names (which change with
 * styling) or generated IDs.
 */
export const TEST_ID_ATTRIBUTES = [
  'data-testid', // React Testing Library, Playwright, Cypress
  'data-test-id', // Hyphenated variant
  'data-test', // Cypress convention
  'data-cy', // Cypress-specific
  'data-qa', // QA team conventions
  'data-e2e', // End-to-end testing convention
  'data-automation-id', // Enterprise/Selenium conventions
]

/**
 * Returns the first test ID attribute selector found on the element,
 * e.g. `[data-testid="product-card"]`, or null if none found.
 */
export function getTestIdSelector(el: Element): string | null {
  for (const attr of TEST_ID_ATTRIBUTES) {
    const value = el.getAttribute(attr)
    if (value) {
      return `[${attr}="${CSS.escape(value)}"]`
    }
  }
  return null
}
