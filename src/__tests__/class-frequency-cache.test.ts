// @vitest-environment jsdom

import {describe, expect, test} from 'vitest'

import {buildClassFrequencyCache} from '../utils/class-frequency-cache'
import {el, mount} from './test-helpers'

describe('buildClassFrequencyCache', () => {
  test('counts class frequency across all elements', () => {
    const container = el('div', {}, [
      el('div', {class: 'd-block'}),
      el('div', {class: 'd-block'}),
      el('span', {class: 'd-block'}),
      el('div', {class: 'unique-class'}),
    ])
    const cleanup = mount(container)

    const cache = buildClassFrequencyCache()
    expect(cache.classCount('d-block')).toBe(3)
    expect(cache.classCount('unique-class')).toBe(1)
    expect(cache.classCount('nonexistent')).toBe(0)

    cleanup()
  })

  test('counts tag+class frequency', () => {
    const container = el('div', {}, [
      el('div', {class: 'd-block'}),
      el('div', {class: 'd-block'}),
      el('span', {class: 'd-block'}),
    ])
    const cleanup = mount(container)

    const cache = buildClassFrequencyCache()
    expect(cache.tagClassCount('div', 'd-block')).toBe(2)
    expect(cache.tagClassCount('span', 'd-block')).toBe(1)
    expect(cache.tagClassCount('p', 'd-block')).toBe(0)

    cleanup()
  })

  test('handles elements with multiple classes', () => {
    const container = el('div', {}, [
      el('span', {class: 'p-name vcard-fullname d-block overflow-hidden'}),
      el('div', {class: 'd-block overflow-hidden'}),
    ])
    const cleanup = mount(container)

    const cache = buildClassFrequencyCache()
    expect(cache.classCount('p-name')).toBe(1)
    expect(cache.classCount('vcard-fullname')).toBe(1)
    expect(cache.classCount('d-block')).toBe(2)
    expect(cache.classCount('overflow-hidden')).toBe(2)

    expect(cache.tagClassCount('span', 'p-name')).toBe(1)
    expect(cache.tagClassCount('span', 'd-block')).toBe(1)
    expect(cache.tagClassCount('div', 'd-block')).toBe(1)

    cleanup()
  })

  test('handles elements with no classes', () => {
    const container = el('div', {}, [el('p'), el('span')])
    const cleanup = mount(container)

    const cache = buildClassFrequencyCache()
    expect(cache.classCount('anything')).toBe(0)
    expect(cache.tagClassCount('p', 'anything')).toBe(0)

    cleanup()
  })
})
