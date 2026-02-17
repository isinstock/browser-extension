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

  test('keeps all unique classes and drops non-unique ones', () => {
    // zcf-pname and zcf-fullname are both unique (count=1)
    // zcf-dblock and zcf-ovhidden are shared with other elements
    const container = el('div', {}, [
      el('span', {class: 'zcf-pname zcf-fullname zcf-dblock zcf-ovhidden'}),
      el('div', {class: 'zcf-dblock'}),
      el('div', {class: 'zcf-dblock'}),
      el('div', {class: 'zcf-dblock zcf-ovhidden'}),
      el('span', {class: 'zcf-dblock zcf-ovhidden'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const result = computeSelector(target)
    // Both unique classes should be kept, non-unique ones dropped
    expect(result).toContain('zcf-pname')
    expect(result).toContain('zcf-fullname')
    expect(result).not.toContain('zcf-dblock')
    expect(result).not.toContain('zcf-ovhidden')

    cleanup()
  })

  test('keeps both classes when multiple classes are unique', () => {
    const container = el('div', {}, [
      el('span', {class: 'zcf-alpha zcf-beta'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const result = computeSelector(target)
    // Both have count=1, both should be kept
    expect(result).toBe('span.zcf-alpha.zcf-beta')

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
    // Use no parent id/semantic class so parent-context can't help either
    const container = el('div', {}, [
      el('div', {class: 'p-4'}, [
        el('div', {class: 'item'}),
        el('div', {class: 'item'}),
        el('div', {class: 'item'}),
      ]),
    ])
    const cleanup = mount(container)

    const target = container.children[0]!.children[1] as Element
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

    // main is unique among its siblings, so main itself should not have nth-of-type
    expect(selector).not.toContain('main:nth-of-type')
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
      el('span', {class: 'zcf-cblock'}),
      el('span', {class: 'zcf-cblock zcf-covh'}),
    ])
    const cleanup = mount(container)

    const cache = buildClassFrequencyCache()
    const target = container.children[0] as Element
    // zcf-uniq is the only unique class for span, zcf-cblock and zcf-covh are shared
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
    )

    debugSpy.mockRestore()
    cleanup()
  })

  // --- Trace data ---

  test('lastTrace contains evaluation details after computeSelector', () => {
    const container = el('div', {}, [
      el('span', {class: 'zcf-trc-unique zcf-trc-common zcf-trc-vcommon'}),
      el('span', {class: 'zcf-trc-common'}),
      el('span', {class: 'zcf-trc-common zcf-trc-vcommon'}),
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
    // No parent id or semantic class — parent-context can't help
    const container = el('div', {}, [
      el('div', {class: 'p-4'}, [
        el('div', {class: 'zcf-trc-dup'}),
        el('div', {class: 'zcf-trc-dup'}),
      ]),
    ])
    const cleanup = mount(container)

    const target = container.children[0]!.children[1] as Element
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

  test('lastTrace includes raw element info (id, classes, testIdAttrs)', () => {
    const container = el('div', {}, [
      el('div', {id: 'zcf-rawinfo', class: 'zcf-alpha zcf-beta', 'data-testid': 'my-card'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    computeSelector(target)

    expect(lastTrace).not.toBeNull()
    expect(lastTrace!.id).toBe('zcf-rawinfo')
    expect(lastTrace!.classes).toEqual(['zcf-alpha', 'zcf-beta'])
    expect(lastTrace!.testIdAttrs).toEqual([{name: 'data-testid', value: 'my-card'}])

    cleanup()
  })

  test('lastTrace has null id and empty arrays when element has no id/classes/testIds', () => {
    const container = el('div', {id: 'zcf-bare-wrap'}, [el('p'), el('p')])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    computeSelector(target)

    expect(lastTrace).not.toBeNull()
    expect(lastTrace!.id).toBeNull()
    expect(lastTrace!.classes).toEqual([])
    expect(lastTrace!.testIdAttrs).toEqual([])

    cleanup()
  })

  // --- Duplicate ID fallthrough ---

  test('duplicate ID falls through to class strategy', () => {
    const container = el('div', {}, [
      el('div', {id: 'dup-id', class: 'zcf-first-item'}),
      el('div', {id: 'dup-id', class: 'zcf-second-item'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const selector = computeSelector(target)

    // Should NOT use #dup-id since it's duplicated
    expect(selector).not.toBe('#dup-id')
    // Should use the unique semantic class instead
    expect(selector).toBe('div.zcf-first-item')
    expect(lastTrace!.strategy).toBe('single-class')

    cleanup()
  })

  // --- Semantic vs utility classification ---

  test('semantic class preferred over utility when both are unique', () => {
    const container = el('div', {}, [
      el('div', {class: 'product-card p-4 bg-white'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const selector = computeSelector(target)

    // Should use the semantic class, not utility classes
    expect(selector).toBe('div.product-card')
    expect(selector).not.toContain('p-4')
    expect(selector).not.toContain('bg-white')

    cleanup()
  })

  // --- Parent-context strategy ---

  test('parent-context when element only has utility classes', () => {
    const container = el('div', {class: 'box'}, [
      el('div', {class: 'p-4'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const selector = computeSelector(target)

    // p-4 is utility, so parent-context should try div.box > div
    expect(selector).toBe('div.box > div')
    expect(lastTrace!.strategy).toBe('parent-context')

    cleanup()
  })

  test('parent-context with parent ID', () => {
    const container = el('div', {id: 'sidebar'}, [
      el('div', {class: 'p-4 flex'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const selector = computeSelector(target)

    // Utility-only classes, parent has ID
    expect(selector).toBe('#sidebar > div')
    expect(lastTrace!.strategy).toBe('parent-context')

    cleanup()
  })

  // --- Hashed class deprioritization ---

  test('hashed class deprioritized below semantic', () => {
    const container = el('div', {}, [
      el('div', {class: 'card styles_card__abc1234'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const selector = computeSelector(target)

    // Should use semantic 'card' not the hashed class
    expect(selector).toBe('div.card')
    expect(selector).not.toContain('styles_card__abc1234')

    cleanup()
  })

  // --- Semantic combination before parent-context ---

  test('semantic combination tried before parent-context', () => {
    const container = el('div', {id: 'wrapper'}, [
      el('div', {class: 'card featured p-4'}),
      el('div', {class: 'card p-4'}),
      el('div', {class: 'featured p-4'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    const selector = computeSelector(target)

    // card+featured combo is unique among divs — should use semantic-combination
    expect(selector).toContain('card')
    expect(selector).toContain('featured')
    expect(selector).not.toContain('p-4')
    expect(lastTrace!.strategy).toBe('semantic-combination')

    cleanup()
  })

  // --- Trace candidates include classification ---

  test('trace candidates include classification field', () => {
    const container = el('div', {}, [
      el('div', {class: 'product-card p-4 styles_card__abc1234'}),
    ])
    const cleanup = mount(container)

    const target = container.children[0] as Element
    computeSelector(target)

    expect(lastTrace).not.toBeNull()
    const byName = Object.fromEntries(lastTrace!.candidates.map(c => [c.name, c.classification]))
    expect(byName['product-card']).toBe('semantic')
    expect(byName['p-4']).toBe('utility')
    expect(byName['styles_card__abc1234']).toBe('hashed')

    cleanup()
  })

  // --- All-utility deep nesting falls to structural ---

  test('all-utility deep nesting falls to structural path when no parent context', () => {
    // All classes are utility and shared, no parent semantic/id context
    const container = el('div', {}, [
      el('div', {class: 'flex'}, [
        el('div', {class: 'p-4'}, [
          el('span', {class: 'text-sm'}),
          el('span', {class: 'text-sm'}),
        ]),
      ]),
    ])
    const cleanup = mount(container)

    const target = container.querySelector('div.flex > div > span') as Element
    const selector = computeSelector(target)

    // text-sm is shared between 2 spans, parent has only utility class
    // Should fall through to structural path
    expect(selector).toContain('nth-of-type')
    expect(lastTrace!.strategy).toBe('structural')

    cleanup()
  })
})
