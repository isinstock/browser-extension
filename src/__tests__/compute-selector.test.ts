// @vitest-environment jsdom

import {describe, expect, test, vi} from 'vitest'

import {buildClassFrequencyCache} from '../utils/class-frequency-cache'
import {computeSelector, lastTrace} from '../utils/compute-selector'
import {el, mount, polyfillCSSEscape} from './test-helpers'

// Make __DEV__ available in tests
;(globalThis as any).__DEV__ = true

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

  // --- Strategy 3: tag.class (frequency-scored) ---

  test('uses tag.class when unique on page', () => {
    const container = el('div', {}, [el('article', {class: 'featured-post'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('article.featured-post')

    cleanup()
  })

  test('prefers most specific single class over all-classes combination', () => {
    // Simulates: span.p-name.vcard-fullname.d-block.overflow-hidden
    // where .vcard-fullname is unique but .d-block and .overflow-hidden are common
    const container = el('div', {}, [
      el('span', {class: 'zcf-pname zcf-fullname zcf-dblock zcf-ovhidden'}),
      // Add elements that share the utility classes
      el('div', {class: 'zcf-dblock'}),
      el('div', {class: 'zcf-dblock'}),
      el('div', {class: 'zcf-dblock zcf-ovhidden'}),
      el('span', {class: 'zcf-dblock'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const result = computeSelector(target)
    // Should pick a single unique class rather than all 4
    // span.zcf-pname(1) or span.zcf-fullname(1) — both are unique, either is acceptable
    expect(result.split('.').length).toBe(2)
    expect(result).not.toContain('zcf-dblock')
    expect(result).not.toContain('zcf-ovhidden')

    cleanup()
  })

  test('picks single class when multiple classes are unique', () => {
    const container = el('div', {}, [
      el('span', {class: 'zcf-alpha zcf-beta'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const result = computeSelector(target)
    // Both have count=1, either is valid — just verify it's a single class
    expect(result).toMatch(/^span\.zcf-/)
    expect(result.split('.').length).toBe(2) // tag.class, not tag.class1.class2

    cleanup()
  })

  test('builds minimal class combination when no single class is unique', () => {
    const container = el('div', {}, [
      el('span', {class: 'zcf-card zcf-feat zcf-sale'}),
      el('span', {class: 'zcf-card zcf-sale'}),
      el('span', {class: 'zcf-feat zcf-sale'}),
      // No other span has both zcf-card+zcf-feat, so the combo should be minimal
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const result = computeSelector(target)
    // Should not include .zcf-sale (matches 3) if zcf-card+zcf-feat is enough
    expect(result).not.toContain('zcf-sale')
    const matched = document.querySelectorAll(result)
    expect(matched).toHaveLength(1)
    expect(matched[0]).toBe(target)

    cleanup()
  })

  test('drops utility classes when semantic class is unique', () => {
    const container = el('div', {}, [
      el('div', {class: 'zcf-prodtitle zcf-flex zcf-ic zcf-mt2'}),
      // Many elements share the utility classes
      el('div', {class: 'zcf-flex zcf-ic'}),
      el('div', {class: 'zcf-flex zcf-mt2'}),
      el('span', {class: 'zcf-flex zcf-ic zcf-mt2'}),
      el('div', {class: 'zcf-flex'}),
      el('div', {class: 'zcf-ic'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    expect(computeSelector(target)).toBe('div.zcf-prodtitle')

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

  // --- With ClassFrequencyCache ---

  test('uses cache for class scoring instead of DOM queries', () => {
    const container = el('div', {}, [
      el('span', {class: 'zcf-uniq zcf-cblock zcf-covh'}),
      el('div', {class: 'zcf-cblock'}),
      el('div', {class: 'zcf-cblock zcf-covh'}),
    ])
    const cleanup = mount(container)

    const cache = buildClassFrequencyCache()
    const target = container.children[0] as Element
    expect(computeSelector(target, cache)).toBe('span.zcf-uniq')

    cleanup()
  })

  test('cache produces same result as uncached', () => {
    const container = el('div', {}, [
      el('span', {class: 'zcf-ctitle zcf-chero zcf-cflex zcf-cjc'}),
      el('div', {class: 'zcf-cflex'}),
      el('div', {class: 'zcf-cflex zcf-cjc'}),
      el('span', {class: 'zcf-cflex'}),
    ])
    const cleanup = mount(container)

    const cache = buildClassFrequencyCache()
    const target = container.children[0] as Element
    const uncached = computeSelector(target)
    const cached = computeSelector(target, cache)
    expect(cached).toBe(uncached)

    cleanup()
  })

  test('logs selector evaluation to console.debug', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const container = el('div', {}, [
      el('span', {class: 'zcf-logtest zcf-logutil'}),
      el('div', {class: 'zcf-logutil'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    computeSelector(target)

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[selector] Evaluating 2 classes on <span>'),
      expect.any(String),
    )
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[selector] Result: span.zcf-logtest'),
      expect.any(String),
    )

    debugSpy.mockRestore()
    cleanup()
  })

  // --- Trace data ---

  test('lastTrace contains evaluation details after computeSelector', () => {
    const container = el('div', {}, [
      el('span', {class: 'zcf-trc-unique zcf-trc-common zcf-trc-vcommon'}),
      el('div', {class: 'zcf-trc-common'}),
      el('div', {class: 'zcf-trc-common zcf-trc-vcommon'}),
      el('span', {class: 'zcf-trc-vcommon'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    computeSelector(target)

    expect(lastTrace).not.toBeNull()
    expect(lastTrace!.tag).toBe('span')
    expect(lastTrace!.strategy).toBe('single-class')
    expect(lastTrace!.result).toBe('span.zcf-trc-unique')
    expect(lastTrace!.kept).toEqual(['zcf-trc-unique'])
    expect(lastTrace!.dropped.length).toBe(2)
    expect(lastTrace!.candidates.length).toBe(3)
    // Candidates should be sorted by count ascending
    expect(lastTrace!.candidates[0]!.count).toBeLessThanOrEqual(lastTrace!.candidates[1]!.count)

    cleanup()
  })

  test('lastTrace shows structural strategy when no classes are unique', () => {
    const container = el('div', {id: 'zcf-trc-wrap'}, [
      el('div', {class: 'zcf-trc-dup'}),
      el('div', {class: 'zcf-trc-dup'}),
    ])
    const cleanup = mount(container)

    const target = container.children[1] as Element
    computeSelector(target)

    expect(lastTrace).not.toBeNull()
    expect(lastTrace!.strategy).toBe('structural')

    cleanup()
  })

  test('lastTrace shows id strategy', () => {
    const container = el('div', {}, [el('div', {id: 'zcf-trc-myid'})])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    computeSelector(target)

    expect(lastTrace).not.toBeNull()
    expect(lastTrace!.strategy).toBe('id')
    expect(lastTrace!.result).toBe('#zcf-trc-myid')

    cleanup()
  })
})
