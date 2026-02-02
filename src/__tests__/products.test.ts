// @vitest-environment jsdom
import {describe, expect, test, vi} from 'vitest'

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

  test('returns true for bare RDFa typeof="Product"', () => {
    const div = document.createElement('div')
    div.setAttribute('typeof', 'Product')
    expect(isProduct(div)).toBe(true)
  })

  test('returns true for RDFa typeof with full https URL', () => {
    const div = document.createElement('div')
    div.setAttribute('typeof', 'https://schema.org/Product')
    expect(isProduct(div)).toBe(true)
  })

  test('returns true for RDFa typeof with full http URL', () => {
    const div = document.createElement('div')
    div.setAttribute('typeof', 'http://schema.org/Product')
    expect(isProduct(div)).toBe(true)
  })

  test('returns true for RDFa typeof="schema:Vehicle"', () => {
    const div = document.createElement('div')
    div.setAttribute('typeof', 'schema:Vehicle')
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

  test('returns true for Microdata itemtype IndividualProduct', () => {
    const div = document.createElement('div')
    div.setAttribute('itemscope', '')
    div.setAttribute('itemtype', 'https://schema.org/IndividualProduct')
    expect(isProduct(div)).toBe(true)
  })

  test('returns false for Microdata itemtype ProductionCompany', () => {
    const div = document.createElement('div')
    div.setAttribute('itemscope', '')
    div.setAttribute('itemtype', 'https://schema.org/ProductionCompany')
    expect(isProduct(div)).toBe(false)
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
    Object.defineProperty(script, 'textContent', {value: null})
    expect(loadProduct(script)).toBeNull()
  })

  test('handles JSON with control characters by stripping newlines', () => {
    const script = document.createElement('script')
    script.textContent = '{"@type": "Product",\n"@context": "https://schema.org"}'
    const result = loadProduct(script)
    expect(result).toEqual({'@type': 'Product', '@context': 'https://schema.org'})
  })

  test('returns null for non-Product @type', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({'@type': 'Organization'})
    expect(loadProduct(script)).toBeNull()
  })

  test('returns first Product from top-level array', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify([
      {'@type': 'Product', '@context': 'https://schema.org', name: 'Test'},
      {'@type': 'BreadcrumbList'},
    ])
    expect(loadProduct(script)).toEqual({'@type': 'Product', '@context': 'https://schema.org', name: 'Test'})
  })

  test('returns null for top-level array without Product', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify([{'@type': 'BreadcrumbList'}, {'@type': 'WebSite'}])
    expect(loadProduct(script)).toBeNull()
  })

  test('returns Product from @graph wrapper', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {'@type': 'WebSite'},
        {'@type': 'Product', name: 'Widget'},
      ],
    })
    expect(loadProduct(script)).toEqual({'@type': 'Product', name: 'Widget'})
  })

  test('returns null for @graph wrapper without Product', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{'@type': 'WebSite'}, {'@type': 'BreadcrumbList'}],
    })
    expect(loadProduct(script)).toBeNull()
  })

  test('returns Product when @type is an array containing Product', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({'@type': ['Product', 'IndividualProduct'], '@context': 'https://schema.org'})
    expect(loadProduct(script)).toEqual({'@type': ['Product', 'IndividualProduct'], '@context': 'https://schema.org'})
  })

  test('returns Product for IndividualProduct subtype', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({'@type': 'IndividualProduct', '@context': 'https://schema.org'})
    expect(loadProduct(script)).toEqual({'@type': 'IndividualProduct', '@context': 'https://schema.org'})
  })

  test('returns Product for ProductModel subtype', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({'@type': 'ProductModel', '@context': 'https://schema.org'})
    expect(loadProduct(script)).toEqual({'@type': 'ProductModel', '@context': 'https://schema.org'})
  })

  test('returns Product for Vehicle subtype', () => {
    const script = document.createElement('script')
    script.textContent = JSON.stringify({'@type': 'Vehicle', '@context': 'https://schema.org'})
    expect(loadProduct(script)).toEqual({'@type': 'Vehicle', '@context': 'https://schema.org'})
  })
})
