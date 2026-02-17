// @vitest-environment jsdom

import {describe, expect, test} from 'vitest'

import {CollectionResult, findCollection, getSharedClasses} from '../utils/collection-selector'
import {el, mount, polyfillCSSEscape} from './test-helpers'

polyfillCSSEscape()

describe('getSharedClasses', () => {
  test('returns empty array for empty input', () => {
    expect(getSharedClasses([])).toEqual([])
  })

  test('returns all classes for a single element', () => {
    expect(getSharedClasses([el('div', {class: 'beta alpha'})])).toEqual(['alpha', 'beta'])
  })

  test('returns intersection of classes across elements', () => {
    const elements = [
      el('div', {class: 'product card featured'}),
      el('div', {class: 'product card sale'}),
      el('div', {class: 'product card'}),
    ]
    expect(getSharedClasses(elements)).toEqual(['card', 'product'])
  })

  test('returns empty array when no classes are shared', () => {
    const elements = [el('div', {class: 'alpha'}), el('div', {class: 'beta'})]
    expect(getSharedClasses(elements)).toEqual([])
  })

  test('returns empty array when elements have no classes', () => {
    const elements = [el('div'), el('div')]
    expect(getSharedClasses(elements)).toEqual([])
  })
})

describe('findCollection', () => {
  test('returns null for a lone element with no siblings', () => {
    const container = el('div', {id: 'lone-parent'}, [el('div', {class: 'only-child'})])
    const cleanup = mount(container)

    const target = container.querySelector('.only-child') as HTMLElement
    expect(findCollection(target)).toBeNull()

    cleanup()
  })

  test('finds collection of same-tag siblings with shared class', () => {
    const container = el('ul', {id: 'products'}, [
      el('li', {class: 'product'}),
      el('li', {class: 'product'}),
      el('li', {class: 'product'}),
    ])
    const cleanup = mount(container)

    const target = container.children[1] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('li.product')
    expect(result!.elements).toHaveLength(3)

    cleanup()
  })

  test('uses parent-scoped selector when global selector matches too many', () => {
    // Two separate lists of li.item — global li.item would match all 5
    const list1 = el('ul', {id: 'list-a'}, [el('li', {class: 'item'}), el('li', {class: 'item'})])
    const list2 = el('ul', {id: 'list-b'}, [
      el('li', {class: 'item'}),
      el('li', {class: 'item'}),
      el('li', {class: 'item'}),
    ])
    const wrapper = el('div', {}, [list1, list2])
    const cleanup = mount(wrapper)

    const target = list1.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('#list-a > li.item')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('handles mixed children with subset detection via target class', () => {
    // Parent has products and separators — shift-clicking a product should find only products
    const container = el('ul', {id: 'mixed'}, [
      el('li', {class: 'product'}),
      el('li', {class: 'separator'}),
      el('li', {class: 'product'}),
      el('li', {class: 'separator'}),
      el('li', {class: 'product'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('li.product')
    expect(result!.elements).toHaveLength(3)
    expect(result!.elements.every(e => e.classList.contains('product'))).toBe(true)

    cleanup()
  })

  test('walks up to find collection at a higher ancestor level', () => {
    // Target is deeply nested — the collection is at the card level
    const cards = [
      el('div', {class: 'card'}, [el('div', {class: 'card-body'}, [el('span', {class: 'title'})])]),
      el('div', {class: 'card'}, [el('div', {class: 'card-body'}, [el('span', {class: 'title'})])]),
      el('div', {class: 'card'}, [el('div', {class: 'card-body'}, [el('span', {class: 'title'})])]),
    ]
    const container = el('div', {id: 'grid'}, cards)
    const cleanup = mount(container)

    // Click on the inner span of the first card
    const target = cards[0]!.querySelector('.title') as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // Should walk up to the span level first (3 spans share .title), but that matches globally
    expect(result!.elements.length).toBeGreaterThanOrEqual(2)

    cleanup()
  })

  test('uses ID-based parent selector', () => {
    const container = el('div', {id: 'product-grid'}, [el('div', {class: 'item'}), el('div', {class: 'item'})])
    // Add another .item elsewhere to prevent global match
    const other = el('div', {class: 'item'})
    const wrapper = el('div', {}, [container, other])
    const cleanup = mount(wrapper)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('#product-grid > div.item')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('falls back to parent > tag when no class selectors work', () => {
    const container = el('ul', {id: 'plain-list'}, [el('li'), el('li'), el('li')])
    const cleanup = mount(container)

    const target = container.children[1] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('#plain-list > li')
    expect(result!.elements).toHaveLength(3)

    cleanup()
  })

  test('handles CSS-escapable class names', () => {
    const container = el('div', {id: 'escape-test'}, [el('div', {class: 'col:1'}), el('div', {class: 'col:1'})])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toContain('col\\:1')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('returns null when max ancestor levels exceeded without finding collection', () => {
    // Build a chain deeper than MAX_ANCESTOR_LEVELS (5) with single children
    let current = el('div', {class: 'target'})
    for (let i = 0; i < 7; i++) {
      current = el('div', {}, [current])
    }
    const cleanup = mount(current)

    const target = current.querySelector('.target') as HTMLElement
    const result = findCollection(target)

    expect(result).toBeNull()

    cleanup()
  })

  test('stops at documentElement boundary', () => {
    // A lone child of body — should return null, not crash
    const child = el('div', {class: 'alone'})
    const cleanup = mount(child)

    const result = findCollection(child)
    expect(result).toBeNull()

    cleanup()
  })

  test('prefers nearest collection over further ancestor', () => {
    // Inner grid (2 items) is nested inside outer grid (3 items)
    const innerItems = [el('span', {class: 'inner'}), el('span', {class: 'inner'})]
    const innerGrid = el('div', {class: 'inner-grid'}, innerItems)

    const outerItems = [innerGrid, el('div', {class: 'outer-item'}), el('div', {class: 'outer-item'})]
    const outer = el('div', {id: 'outer'}, outerItems)
    const cleanup = mount(outer)

    // Click on first inner span — should find the inner collection first
    const target = innerItems[0]!
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('span.inner')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('handles Tailwind-like utility classes by finding shared ones', () => {
    const container = el('div', {id: 'tw-grid'}, [
      el('div', {class: 'product p-4 bg-white rounded-lg shadow'}),
      el('div', {class: 'product p-4 bg-white rounded-lg shadow hover:shadow-md'}),
      el('div', {class: 'product p-4 bg-white rounded-lg shadow'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // Should find a shared class selector that matches all 3
    expect(result!.elements).toHaveLength(3)

    cleanup()
  })

  test('uses tag.allClasses parent selector when needed', () => {
    // Parent identified by tag + all its classes (no ID, but unique combo)
    const container = el('section', {class: 'products featured'}, [
      el('div', {class: 'card'}),
      el('div', {class: 'card'}),
    ])
    // Add another div.card elsewhere to prevent global match
    const other = el('div', {class: 'card'})
    const wrapper = el('div', {}, [container, other])
    const cleanup = mount(wrapper)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // Parent should be identified by section.featured.products (sorted)
    expect(result!.selector).toContain('section.')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('handles elements with only data attributes and no classes', () => {
    const container = el('div', {id: 'data-list'}, [
      el('div', {'data-item': 'true'}),
      el('div', {'data-item': 'true'}),
      el('div', {'data-item': 'true'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // No classes, so should fall back to parent > tag
    expect(result!.selector).toBe('#data-list > div')
    expect(result!.elements).toHaveLength(3)

    cleanup()
  })

  test('target element is always included in result', () => {
    const container = el('ul', {id: 'inclusion-test'}, [
      el('li', {class: 'item'}),
      el('li', {class: 'item'}),
      el('li', {class: 'item'}),
    ])
    const cleanup = mount(container)

    const target = container.children[1] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.elements).toContain(target)

    cleanup()
  })

  test('finds collection using individual parent class when combined is not unique', () => {
    // Two sections with same class combo — but one has an additional distinguishing class
    const section1 = el('section', {class: 'grid primary'}, [el('div', {class: 'card'}), el('div', {class: 'card'})])
    const section2 = el('section', {class: 'grid secondary'}, [el('div', {class: 'card'}), el('div', {class: 'card'})])
    const wrapper = el('div', {}, [section1, section2])
    const cleanup = mount(wrapper)

    const target = section1.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.elements).toHaveLength(2)
    // Parent identified by tag + classes (combined is unique: section.grid.primary)
    expect(result!.selector).toContain('section.')

    cleanup()
  })

  test('all returned elements match the selector via querySelectorAll', () => {
    const container = el('div', {id: 'verify-selector'}, [
      el('article', {class: 'post'}),
      el('article', {class: 'post'}),
      el('article', {class: 'post featured'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // Verify the selector actually works
    const matched = Array.from(document.querySelectorAll(result!.selector))
    expect(matched).toEqual(result!.elements)

    cleanup()
  })

  test('handles body as parent', () => {
    // Elements directly under body
    const item1 = el('section', {class: 'page-section'})
    const item2 = el('section', {class: 'page-section'})

    document.body.appendChild(item1)
    document.body.appendChild(item2)

    const result = findCollection(item1)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('section.page-section')
    expect(result!.elements).toHaveLength(2)

    item1.remove()
    item2.remove()
  })

  test('returns null for single child under each ancestor', () => {
    const container = el('div', {id: 'single-chain'}, [
      el('section', {}, [el('article', {}, [el('div', {class: 'target'})])]),
    ])
    const cleanup = mount(container)

    const target = container.querySelector('.target') as HTMLElement
    const result = findCollection(target)

    expect(result).toBeNull()

    cleanup()
  })

  test('handles elements where shared class selector matches different count than siblings', () => {
    // 3 siblings share .item class, but there's a .item elsewhere in the document
    const container = el('div', {id: 'mismatch-parent'}, [
      el('div', {class: 'item special'}),
      el('div', {class: 'item'}),
      el('div', {class: 'item'}),
    ])
    const stray = el('div', {class: 'item'})
    const wrapper = el('div', {}, [container, stray])
    const cleanup = mount(wrapper)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // Global div.item matches 4 (not 3), so should fall back to parent-scoped
    expect(result!.selector).toBe('#mismatch-parent > div.item')
    expect(result!.elements).toHaveLength(3)

    cleanup()
  })

  // --- Test ID attribute strategy tests ---

  test('prefers shared test ID attribute over class-based selectors', () => {
    const container = el('div', {id: 'testid-grid'}, [
      el('div', {class: 'card', 'data-testid': 'product-1'}),
      el('div', {class: 'card', 'data-testid': 'product-2'}),
      el('div', {class: 'card', 'data-testid': 'product-3'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // Should prefer div[data-testid] over div.card
    expect(result!.selector).toBe('div[data-testid]')
    expect(result!.elements).toHaveLength(3)

    cleanup()
  })

  test('uses data-cy attribute for collection when shared', () => {
    const container = el('ul', {id: 'cy-list'}, [el('li', {'data-cy': 'item-a'}), el('li', {'data-cy': 'item-b'})])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('li[data-cy]')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('falls back to parent-scoped test ID when global matches too many', () => {
    const list1 = el('ul', {id: 'list-1'}, [el('li', {'data-testid': 'item-a'}), el('li', {'data-testid': 'item-b'})])
    const list2 = el('ul', {id: 'list-2'}, [
      el('li', {'data-testid': 'item-c'}),
      el('li', {'data-testid': 'item-d'}),
      el('li', {'data-testid': 'item-e'}),
    ])
    const wrapper = el('div', {}, [list1, list2])
    const cleanup = mount(wrapper)

    const target = list1.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // Global li[data-testid] matches 5, not 2, so should fall back to parent-scoped
    expect(result!.selector).toBe('#list-1 > li[data-testid]')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('uses test ID subset detection for mixed siblings', () => {
    // Parent has items with data-testid and separators without
    const container = el('div', {id: 'mixed-testid'}, [
      el('div', {'data-testid': 'product', class: 'item'}),
      el('div', {class: 'separator'}),
      el('div', {'data-testid': 'product', class: 'item'}),
      el('div', {class: 'separator'}),
      el('div', {'data-testid': 'product', class: 'item'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // target has data-testid="product" — should find all 3 via exact value match
    expect(result!.selector).toBe('div[data-testid="product"]')
    expect(result!.elements).toHaveLength(3)

    cleanup()
  })

  test('prefers data-testid over data-qa when both present', () => {
    const container = el('div', {id: 'priority-test'}, [
      el('div', {'data-testid': 'card-1', 'data-qa': 'qa-1'}),
      el('div', {'data-testid': 'card-2', 'data-qa': 'qa-2'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    // data-testid is higher priority than data-qa
    expect(result!.selector).toBe('div[data-testid]')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })

  test('test ID strategy still falls back to class when no test IDs present', () => {
    const container = el('ul', {id: 'no-testid'}, [el('li', {class: 'product'}), el('li', {class: 'product'})])
    const cleanup = mount(container)

    const target = container.children[0] as HTMLElement
    const result = findCollection(target)

    expect(result).not.toBeNull()
    expect(result!.selector).toBe('li.product')
    expect(result!.elements).toHaveLength(2)

    cleanup()
  })
})
