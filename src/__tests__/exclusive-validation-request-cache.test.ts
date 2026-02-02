import {describe, expect, test, vi} from 'vitest'

import {ProductValidationResult} from '../@types/api'
import ExclusiveValidationRequestCache from '../utils/exclusive-validation-request-cache'

const mockResponse = (data: any, ok = true): Response =>
  ({
    ok,
    json: () => Promise.resolve(data),
  }) as Response

describe('ExclusiveValidationRequestCache', () => {
  test('calls callback with parsed response on success', async () => {
    const responseData = {result: ProductValidationResult.Supported, availability: 'InStock'}
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(responseData))
    const cache = new ExclusiveValidationRequestCache(fetchFn)
    const callback = vi.fn()

    await cache.fetchWithLock('https://example.com', callback)
    // Wait for the promise chain to resolve
    await new Promise(r => setTimeout(r, 0))

    expect(callback).toHaveBeenCalledWith(responseData)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('returns Unsupported for non-ok response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(null, false))
    const cache = new ExclusiveValidationRequestCache(fetchFn)
    const callback = vi.fn()

    await cache.fetchWithLock('https://example.com', callback)
    await new Promise(r => setTimeout(r, 0))

    expect(callback).toHaveBeenCalledWith({result: ProductValidationResult.Unsupported})
  })

  test('deduplicates in-flight requests for the same URL', async () => {
    let resolve: (value: Response) => void
    const pending = new Promise<Response>(r => {
      resolve = r
    })
    const fetchFn = vi.fn().mockReturnValue(pending)
    const cache = new ExclusiveValidationRequestCache(fetchFn)
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    await cache.fetchWithLock('https://example.com', callback1)
    await cache.fetchWithLock('https://example.com', callback2)

    expect(fetchFn).toHaveBeenCalledTimes(1)

    resolve!(mockResponse({result: ProductValidationResult.Supported}))
    await new Promise(r => setTimeout(r, 0))

    expect(callback1).toHaveBeenCalled()
    expect(callback2).toHaveBeenCalled()
  })

  test('cancelAllRequests aborts in-flight requests', async () => {
    let receivedSignal: AbortSignal | undefined
    const fetchFn = vi.fn().mockImplementation((_path, _method, _body, signal) => {
      receivedSignal = signal
      return new Promise(() => {}) // never resolves
    })
    const cache = new ExclusiveValidationRequestCache(fetchFn)

    await cache.fetchWithLock('https://example.com', vi.fn())
    cache.cancelAllRequests()

    expect(receivedSignal?.aborted).toBe(true)
  })

  test('makes separate requests for different URLs', async () => {
    const responseData = {result: ProductValidationResult.Supported}
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(responseData))
    const cache = new ExclusiveValidationRequestCache(fetchFn)

    await cache.fetchWithLock('https://example.com/1', vi.fn())
    await cache.fetchWithLock('https://example.com/2', vi.fn())

    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
