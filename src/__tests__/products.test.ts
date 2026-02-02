// @vitest-environment jsdom
import {describe, expect, test, vi} from 'vitest'

import {isProductSchema} from '../utils/helpers'
import {isProduct, loadProduct} from '../utils/products'

describe('isProduct', () => {
  test('returns true for SCRIPT tag with valid Product JSON-LD', () => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({'@type': 'Product', '@context': 'https://schema.org'})
    expect(isProduct(script)).toBe(true)
  })

  test('returns false for SCRIPT tag with non-Product JSON-LD', () => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({'@type': 'Organization'})
    expect(isProduct(script)).toBe(false)
  })

  test('returns false for SCRIPT tag with empty content', () => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = ''
    expect(isProduct(script)).toBe(false)
  })

  test('returns false for SCRIPT tag with invalid JSON', () => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = 'not json at all'
    expect(isProduct(script)).toBe(false)
  })

  test('returns true for element with RDFa typeof="schema:Product"', () => {
    const div = document.createElement('div')
    div.setAttribute('typeof', 'schema:Product')
    expect(isProduct(div)).toBe(true)
  })

  test('returns true for RDFa typeof with different casing', () => {
    const div = document.createElement('div')
    div.setAttribute('typeof', 'Schema:product')
    expect(isProduct(div)).toBe(true)
  })

  test('returns true for RDFa typeof with whitespace', () => {
    const div = document.createElement('div')
    div.setAttribute('typeof', '  schema:Product  ')
    expect(isProduct(div)).toBe(true)
  })

  test('returns true for element with Microdata itemtype containing Product', () => {
    const div = document.createElement('div')
    div.setAttribute('itemscope', '')
    div.setAttribute('itemtype', 'https://schema.org/Product')
    expect(isProduct(div)).toBe(true)
  })

  test('returns true for Microdata itemtype with http prefix', () => {
    const div = document.createElement('div')
    div.setAttribute('itemscope', '')
    div.setAttribute('itemtype', 'http://schema.org/Product')
    expect(isProduct(div)).toBe(true)
  })

  test('returns false for element without product attributes', () => {
    const div = document.createElement('div')
    expect(isProduct(div)).toBe(false)
  })
})

describe('loadProduct', () => {
  test('returns Product for valid JSON-LD', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({'@type': 'Product', '@context': 'https://schema.org'})
    const result = loadProduct(script)
    expect(result).toEqual({'@type': 'Product', '@context': 'https://schema.org'})
  })

  test('returns null for invalid JSON', () => {
    const script = document.createElement('script')
    script.textContent = 'not json'
    expect(loadProduct(script)).toBeNull()
  })

  test('returns null for empty content', () => {
    const script = document.createElement('script')
    script.textContent = ''
    expect(loadProduct(script)).toBeNull()
  })

  test('returns null for null textContent', () => {
    const script = document.createElement('script')
    // textContent defaults to '' in jsdom, so we need to set it explicitly
    Object.defineProperty(script, 'textContent', {value: null})
    expect(loadProduct(script)).toBeNull()
  })

  test('handles JSON with control characters by stripping newlines', () => {
    const script = document.createElement('script')
    // Valid JSON that happens to have newlines (normal behavior)
    script.textContent = '{"@type": "Product",\n"@context": "https://schema.org"}'
    const result = loadProduct(script)
    expect(result).toEqual({'@type': 'Product', '@context': 'https://schema.org'})
  })

  test('returns null for non-Product @type', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({'@type': 'Organization'})
    expect(loadProduct(script)).toBeNull()
  })

  test('returns null for array of products', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify([{'@type': 'Product', '@context': 'https://schema.org'}])
    expect(loadProduct(script)).toBeNull()
  })
})

describe('isProductSchema', () => {
  test('returns true for Product', () => {
    expect(isProductSchema({'@type': 'Product'})).toBe(true)
  })

  test('returns false for array', () => {
    expect(isProductSchema([{'@type': 'Product'}])).toBe(false)
  })

  test('returns false for null', () => {
    expect(isProductSchema(null)).toBe(false)
  })

  test('returns false for other @type', () => {
    expect(isProductSchema({'@type': 'WebSite'})).toBe(false)
  })
})
