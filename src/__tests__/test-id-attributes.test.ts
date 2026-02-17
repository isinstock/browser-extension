// @vitest-environment jsdom

import {describe, expect, test} from 'vitest'

import {TEST_ID_ATTRIBUTES, getTestIdSelector} from '../utils/test-id-attributes'
import {el, polyfillCSSEscape} from './test-helpers'

polyfillCSSEscape()

describe('TEST_ID_ATTRIBUTES', () => {
  test('contains expected attributes in order', () => {
    expect(TEST_ID_ATTRIBUTES).toEqual([
      'data-testid',
      'data-test-id',
      'data-test',
      'data-cy',
      'data-qa',
      'data-e2e',
      'data-automation-id',
    ])
  })
})

describe('getTestIdSelector', () => {
  test('returns null when element has no test ID attributes', () => {
    const element = el('div', {class: 'card', id: 'my-card'})
    expect(getTestIdSelector(element)).toBeNull()
  })

  test('returns selector for data-testid', () => {
    const element = el('div', {'data-testid': 'product-card'})
    expect(getTestIdSelector(element)).toBe('[data-testid="product-card"]')
  })

  test('returns selector for data-test-id', () => {
    const element = el('div', {'data-test-id': 'checkout-button'})
    expect(getTestIdSelector(element)).toBe('[data-test-id="checkout-button"]')
  })

  test('returns selector for data-test', () => {
    const element = el('div', {'data-test': 'header'})
    expect(getTestIdSelector(element)).toBe('[data-test="header"]')
  })

  test('returns selector for data-cy', () => {
    const element = el('button', {'data-cy': 'submit-btn'})
    expect(getTestIdSelector(element)).toBe('[data-cy="submit-btn"]')
  })

  test('returns selector for data-qa', () => {
    const element = el('input', {'data-qa': 'email-field'})
    expect(getTestIdSelector(element)).toBe('[data-qa="email-field"]')
  })

  test('returns selector for data-e2e', () => {
    const element = el('span', {'data-e2e': 'price-label'})
    expect(getTestIdSelector(element)).toBe('[data-e2e="price-label"]')
  })

  test('returns selector for data-automation-id', () => {
    const element = el('div', {'data-automation-id': 'nav-menu'})
    expect(getTestIdSelector(element)).toBe('[data-automation-id="nav-menu"]')
  })

  test('prefers data-testid over other attributes when multiple present', () => {
    const element = el('div', {
      'data-testid': 'preferred',
      'data-cy': 'also-present',
      'data-qa': 'another-one',
    })
    expect(getTestIdSelector(element)).toBe('[data-testid="preferred"]')
  })

  test('falls through to next attribute when higher-priority is empty', () => {
    const element = el('div', {'data-testid': '', 'data-cy': 'fallback'})
    expect(getTestIdSelector(element)).toBe('[data-cy="fallback"]')
  })

  test('escapes special characters in attribute values', () => {
    const element = el('div', {'data-testid': 'card.item'})
    expect(getTestIdSelector(element)).toBe('[data-testid="card\\.item"]')
  })

  test('handles values with spaces', () => {
    const element = el('div', {'data-testid': 'product card'})
    expect(getTestIdSelector(element)).toBe('[data-testid="product\\ card"]')
  })
})
