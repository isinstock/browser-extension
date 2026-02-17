// @vitest-environment jsdom

import {describe, expect, test} from 'vitest'

import {getAvailableAttributes, getElementAttributes} from '../utils/element-attributes'
import {el} from './test-helpers'

describe('getElementAttributes', () => {
  test('returns empty array for element with no attributes', () => {
    expect(getElementAttributes(el('div'))).toEqual([])
  })

  test('excludes noise attributes (class, style, id)', () => {
    expect(getElementAttributes(el('div', {class: 'foo', style: 'color:red', id: 'bar', 'data-price': '10'}))).toEqual([
      'data-price',
    ])
  })

  test('sorts data-* attributes alphabetically', () => {
    expect(getElementAttributes(el('div', {'data-sku': 'A', 'data-brand': 'B', 'data-price': '10'}))).toEqual([
      'data-brand',
      'data-price',
      'data-sku',
    ])
  })

  test('sorts content attributes in priority order', () => {
    expect(getElementAttributes(el('a', {alt: 'img', href: '/page', title: 'link'}))).toEqual(['href', 'alt', 'title'])
  })

  test('groups data-* first, then content, then rest', () => {
    const result = getElementAttributes(el('a', {'data-id': '1', href: '/page', role: 'button', 'aria-label': 'click'}))
    expect(result).toEqual(['data-id', 'href', 'aria-label', 'role'])
  })
})

describe('getAvailableAttributes', () => {
  test('returns empty array for empty elements list', () => {
    expect(getAvailableAttributes([])).toEqual([])
  })

  test('returns attributes from a single element', () => {
    expect(getAvailableAttributes([el('div', {'data-price': '10', href: '/page'})])).toEqual(['data-price', 'href'])
  })

  test('unions attributes across multiple elements with different attributes', () => {
    const elements = [el('div', {'data-price': '10.99'}), el('div', {'data-sku': 'ABC123'})]

    const result = getAvailableAttributes(elements)
    expect(result).toEqual(['data-price', 'data-sku'])
  })

  test('deduplicates attributes shared across elements', () => {
    const elements = [
      el('div', {'data-price': '10.99', 'data-sku': 'ABC'}),
      el('div', {'data-price': '20.99', 'data-brand': 'Acme'}),
    ]

    const result = getAvailableAttributes(elements)
    expect(result).toEqual(['data-brand', 'data-price', 'data-sku'])
  })

  test('excludes noise attributes from all elements', () => {
    const elements = [
      el('div', {class: 'product', 'data-price': '10'}),
      el('div', {id: 'item-2', style: 'display:none', 'data-sku': 'XYZ'}),
    ]

    const result = getAvailableAttributes(elements)
    expect(result).toEqual(['data-price', 'data-sku'])
  })

  test('maintains correct grouping across mixed elements', () => {
    const elements = [
      el('a', {href: '/page-1', 'data-id': '1'}),
      el('span', {role: 'button', title: 'Click me', 'data-action': 'buy'}),
      el('img', {src: '/img.png', alt: 'photo'}),
    ]

    const result = getAvailableAttributes(elements)
    // data-* first (sorted), then content attrs (priority order), then rest (sorted)
    expect(result).toEqual(['data-action', 'data-id', 'href', 'src', 'alt', 'title', 'role'])
  })

  test('collects dynamic attributes where elements differ', () => {
    // This is the key scenario: an advanced selector like ".product-row" matches
    // multiple elements. The first has attribute="value" and the second has
    // value="attribute". Both attribute names must appear in the result.
    const elements = [
      el('div', {'data-color': 'red'}),
      el('div', {'data-size': 'large'}),
      el('div', {'data-color': 'blue', 'data-weight': '5kg'}),
    ]

    const result = getAvailableAttributes(elements)
    expect(result).toEqual(['data-color', 'data-size', 'data-weight'])
  })
})
