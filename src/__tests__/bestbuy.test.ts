import {describe, expect, test} from 'vitest'

import {transformBestBuyUrl} from '../utils/bestbuy'

describe('transformBestBuyUrl', () => {
  test('transforms /product/ to /site/ and appends .p to SKU', () => {
    const url = 'https://www.bestbuy.com/product/some-product-name/J3RZQZR92W'
    const result = transformBestBuyUrl(url, '1234567')
    expect(result).toBe('https://www.bestbuy.com/site/some-product-name/1234567.p')
  })

  test('returns original URL if no /product/ segment', () => {
    const url = 'https://www.bestbuy.com/site/some-product/999.p'
    const result = transformBestBuyUrl(url, '1234567')
    expect(result).toBe('https://www.bestbuy.com/site/some-product/1234567.p')
  })

  test('returns original string for invalid URL', () => {
    const result = transformBestBuyUrl('not-a-url', '123')
    expect(result).toBe('not-a-url')
  })

  test('handles URL with no path segments beyond domain', () => {
    const result = transformBestBuyUrl('https://www.bestbuy.com/', '123')
    expect(result).toBe('https://www.bestbuy.com/123.p')
  })

  test('preserves query parameters', () => {
    const url = 'https://www.bestbuy.com/product/some-product/ABC123?intl=nosplash'
    const result = transformBestBuyUrl(url, '7654321')
    expect(result).toBe('https://www.bestbuy.com/site/some-product/7654321.p?intl=nosplash')
  })
})
