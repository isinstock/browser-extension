// @vitest-environment jsdom

import {describe, expect, test} from 'vitest'

import {computeSelector} from '../utils/compute-selector'
import {el, mount, polyfillCSSEscape} from './test-helpers'

polyfillCSSEscape()

describe('computeSelector', () => {
  // --- Strategy 1: Test ID attributes ---

  test('uses data-testid when unique on page', () => {
    const container = el('div', {}, [el('div', {'data-testid': 'product-card', class: 'card'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('[data-testid="product-card"]')

    cleanup()
  })

  test('uses data-cy when unique on page', () => {
    const container = el('div', {}, [el('button', {'data-cy': 'submit-btn'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('[data-cy="submit-btn"]')

    cleanup()
  })

  test('skips test ID when not unique and falls through to #id', () => {
    const container = el('div', {}, [
      el('div', {'data-testid': 'card', id: 'first-card'}),
      el('div', {'data-testid': 'card'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('#first-card')

    cleanup()
  })

  test('prefers test ID over #id when test ID is unique', () => {
    const container = el('div', {}, [el('div', {'data-testid': 'unique-card', id: 'my-id'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('[data-testid="unique-card"]')

    cleanup()
  })

  test('prefers data-testid over data-qa when both present and unique', () => {
    const container = el('div', {}, [el('div', {'data-testid': 'preferred', 'data-qa': 'also-present'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('[data-testid="preferred"]')

    cleanup()
  })

  // --- Strategy 2: #id ---

  test('uses #id when element has id and no test ID', () => {
    const container = el('div', {}, [el('div', {id: 'sidebar', class: 'panel'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('#sidebar')

    cleanup()
  })

  test('escapes special characters in id', () => {
    const container = el('div', {}, [el('div', {id: 'my.special:id'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('#my\\.special\\:id')

    cleanup()
  })

  // --- Strategy 3: tag.class ---

  test('uses tag.class when unique on page', () => {
    const container = el('div', {}, [el('article', {class: 'featured-post'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('article.featured-post')

    cleanup()
  })

  test('uses tag with all classes when unique', () => {
    const container = el('div', {}, [el('div', {class: 'card featured'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('div.card.featured')

    cleanup()
  })

  test('skips class selector when not unique and falls through to structural path', () => {
    const container = el('div', {id: 'wrapper'}, [
      el('div', {class: 'item'}),
      el('div', {class: 'item'}),
      el('div', {class: 'item'}),
    ])
    const cleanup = mount(container)

    const target = container.children[1] as Element
    const selector = computeSelector(target)

    // Should NOT be div.item (matches 3)
    expect(selector).not.toBe('div.item')
    // Should use nth-of-type structural path
    expect(selector).toContain('nth-of-type')

    cleanup()
  })

  // --- Strategy 4: Structural path (nth-of-type) ---

  test('builds structural path for element with no unique attributes', () => {
    const container = el('div', {id: 'root'}, [el('ul', {}, [el('li'), el('li'), el('li')])])
    const cleanup = mount(container)

    const target = container.querySelector('ul')!.children[1] as Element
    const selector = computeSelector(target)

    // Should contain nth-of-type for the second li
    expect(selector).toContain('li:nth-of-type(2)')
    // Verify it actually selects the right element
    const matched = document.querySelectorAll(selector)
    expect(matched).toHaveLength(1)
    expect(matched[0]).toBe(target)

    cleanup()
  })

  test('structural path skips nth-of-type for unique tag among siblings', () => {
    const container = el('div', {id: 'page'}, [el('header'), el('main'), el('footer')])
    const cleanup = mount(container)

    const target = container.querySelector('main') as Element
    const selector = computeSelector(target)

    // main is unique among its siblings, so no nth-of-type needed
    expect(selector).not.toContain('nth-of-type')
    expect(selector).toContain('main')

    cleanup()
  })

  // --- Edge cases ---

  test('selector actually resolves to the target element', () => {
    const container = el('section', {}, [
      el('div', {class: 'row'}, [el('span', {class: 'cell'}), el('span', {class: 'cell'})]),
      el('div', {class: 'row'}, [el('span', {class: 'cell'}), el('span', {class: 'cell'})]),
    ])
    const cleanup = mount(container)

    const target = container.children[1]!.children[0] as Element
    const selector = computeSelector(target)

    const matched = document.querySelectorAll(selector)
    expect(matched).toHaveLength(1)
    expect(matched[0]).toBe(target)

    cleanup()
  })

  test('handles element with empty class list', () => {
    const container = el('div', {id: 'empty-class-parent'}, [el('p'), el('p')])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const selector = computeSelector(target)

    expect(selector).toContain('nth-of-type')
    const matched = document.querySelectorAll(selector)
    expect(matched).toHaveLength(1)
    expect(matched[0]).toBe(target)

    cleanup()
  })
})
