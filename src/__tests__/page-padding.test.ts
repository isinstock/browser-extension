// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {PagePaddingManager} from '../utils/page-padding'

type ResizeCallback = (entries: ResizeObserverEntry[]) => void

let resizeCallback: ResizeCallback

beforeEach(() => {
  // jsdom doesn't provide ResizeObserver — supply a minimal mock
  global.ResizeObserver = vi.fn().mockImplementation((cb: ResizeCallback) => {
    resizeCallback = cb
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  }) as unknown as typeof ResizeObserver

  document.documentElement.style.paddingBottom = ''
})

afterEach(() => {
  document.documentElement.style.paddingBottom = ''
})

function fireResize(height: number) {
  resizeCallback([
    {
      borderBoxSize: [{blockSize: height, inlineSize: 0}],
      contentRect: {height, width: 0, x: 0, y: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => {}},
      contentBoxSize: [{blockSize: height, inlineSize: 0}],
      devicePixelContentBoxSize: [{blockSize: height, inlineSize: 0}],
      target: document.createElement('div'),
    } as unknown as ResizeObserverEntry,
  ])
}

describe('PagePaddingManager', () => {
  test('applies padding-bottom matching observed element height', () => {
    const manager = new PagePaddingManager()
    const el = document.createElement('div')

    manager.start(el)
    fireResize(200)

    expect(document.documentElement.style.paddingBottom).toBe('200px')
  })

  test('updates padding when element resizes', () => {
    const manager = new PagePaddingManager()
    const el = document.createElement('div')

    manager.start(el)
    fireResize(150)
    expect(document.documentElement.style.paddingBottom).toBe('150px')

    fireResize(300)
    expect(document.documentElement.style.paddingBottom).toBe('300px')
  })

  test('restores original padding on stop', () => {
    document.documentElement.style.paddingBottom = '40px'

    const manager = new PagePaddingManager()
    const el = document.createElement('div')

    manager.start(el)
    fireResize(200)
    expect(document.documentElement.style.paddingBottom).toBe('200px')

    manager.stop(el)
    expect(document.documentElement.style.paddingBottom).toBe('40px')
  })

  test('restores empty padding when none was set', () => {
    const manager = new PagePaddingManager()
    const el = document.createElement('div')

    manager.start(el)
    fireResize(100)
    expect(document.documentElement.style.paddingBottom).toBe('100px')

    manager.stop(el)
    expect(document.documentElement.style.paddingBottom).toBe('')
  })

  test('falls back to contentRect.height when borderBoxSize is missing', () => {
    const manager = new PagePaddingManager()
    const el = document.createElement('div')

    manager.start(el)
    resizeCallback([
      {
        contentRect: {height: 180, width: 0, x: 0, y: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => {}},
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
        target: el,
      } as unknown as ResizeObserverEntry,
    ])

    expect(document.documentElement.style.paddingBottom).toBe('180px')
  })
})
