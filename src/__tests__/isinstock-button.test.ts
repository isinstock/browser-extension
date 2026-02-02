// @vitest-environment jsdom
import {afterEach, describe, expect, test, vi} from 'vitest'

import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import {insertIsInStockButton, removeIsInStockButton} from '../elements/isinstock-button'

// Mock the CSS import
vi.mock('../elements/isinstock-button/style.css', () => ({default: ''}))

// Mock SVG imports
vi.mock('../../public/images/inventory-states/available.svg', () => ({default: 'available.svg'}))
vi.mock('../../public/images/inventory-states/unavailable.svg', () => ({default: 'unavailable.svg'}))
vi.mock('../../public/images/inventory-states/unknown.svg', () => ({default: 'unknown.svg'}))

// Mock fetchApi to avoid actual network calls from selector validation
vi.mock('../utils/fetch-api', () => ({
  default: vi.fn().mockResolvedValue({ok: true, json: () => Promise.resolve({})}),
}))

// Mock UserProvider to avoid hooks dependency
vi.mock('../contexts/user-context', () => ({
  UserProvider: ({children}: {children: any}) => children,
}))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('insertIsInStockButton', () => {
  test('creates button element with shadow DOM', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'InStock',
      track_url: 'https://isinstock.com/track?url=test',
    }

    const wrapper = insertIsInStockButton({productValidation: validation})

    expect(wrapper.id).toBe('isinstock-button')
    expect(wrapper.shadowRoot).not.toBeNull()
  })

  test('renders in fixed position when no selectors match', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'InStock',
      track_url: 'https://isinstock.com/track?url=test',
    }

    const wrapper = insertIsInStockButton({productValidation: validation})

    expect(wrapper.style.position).toBe('fixed')
    expect(wrapper.style.zIndex).toBe('2147483647')
    expect(wrapper.style.bottom).toBe('10px')
    expect(wrapper.style.right).toBe('10px')
  })

  test('inserts after matching selector with insert=after', () => {
    const target = document.createElement('div')
    target.id = 'target'
    document.body.appendChild(target)

    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'InStock',
      track_url: 'https://isinstock.com/track?url=test',
      selectors: [{selector: '#target', insert: 'after', exclusive: false, priority: 0}],
    }

    const wrapper = insertIsInStockButton({productValidation: validation})

    expect(wrapper.style.marginTop).toBe('10px')
    expect(wrapper.isConnected).toBe(true)
  })

  test('inserts before matching selector with insert=before', () => {
    const target = document.createElement('div')
    target.id = 'target'
    document.body.appendChild(target)

    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'InStock',
      track_url: 'https://isinstock.com/track?url=test',
      selectors: [{selector: '#target', insert: 'before', exclusive: false, priority: 0}],
    }

    const wrapper = insertIsInStockButton({productValidation: validation})

    expect(wrapper.style.marginBottom).toBe('10px')
    expect(wrapper.isConnected).toBe(true)
  })

  test('removes existing button before inserting new one', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'InStock',
      track_url: 'https://isinstock.com/track?url=test',
    }

    insertIsInStockButton({productValidation: validation})
    insertIsInStockButton({productValidation: validation})

    const buttons = document.querySelectorAll('#isinstock-button')
    expect(buttons.length).toBe(1)
  })

  test('renders nothing for Error result', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Error,
    }

    const wrapper = insertIsInStockButton({productValidation: validation})
    const link = wrapper.shadowRoot?.querySelector('a')

    expect(link).toBeNull()
  })

  test('renders available state for InStock availability', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'InStock',
      track_url: 'https://isinstock.com/track?url=test',
    }

    const wrapper = insertIsInStockButton({productValidation: validation})
    const link = wrapper.shadowRoot?.querySelector('a')

    expect(link?.getAttribute('data-inventory-state-normalized')).toBe('available')
    expect(link?.textContent).toBe('In Stock')
  })

  test('renders Pre-Order label for PreOrder availability', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'PreOrder',
      track_url: 'https://isinstock.com/track?url=test',
    }

    const wrapper = insertIsInStockButton({productValidation: validation})
    const link = wrapper.shadowRoot?.querySelector('a')

    expect(link?.getAttribute('data-inventory-state-normalized')).toBe('available')
    expect(link?.textContent).toBe('Pre-Order')
  })

  test('renders unavailable state for OutOfStock availability', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'OutOfStock',
      track_url: 'https://isinstock.com/track?url=test',
    }

    const wrapper = insertIsInStockButton({productValidation: validation})
    const link = wrapper.shadowRoot?.querySelector('a')

    expect(link?.getAttribute('data-inventory-state-normalized')).toBe('unavailable')
    expect(link?.textContent).toBe('Notify Me When Available')
  })

  test('renders unknown state for Unsupported result', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Unsupported,
    }

    const wrapper = insertIsInStockButton({productValidation: validation})
    const link = wrapper.shadowRoot?.querySelector('a')

    expect(link?.getAttribute('data-inventory-state-normalized')).toBe('unknown')
    expect(link?.textContent).toBe('Not Trackable')
  })

  test('sets correct link attributes', () => {
    const validation: ProductValidationResponse = {
      result: ProductValidationResult.Supported,
      availability: 'InStock',
      track_url: 'https://isinstock.com/track?url=test',
    }

    const wrapper = insertIsInStockButton({productValidation: validation})
    const link = wrapper.shadowRoot?.querySelector('a')

    expect(link?.getAttribute('href')).toBe('https://isinstock.com/track?url=test')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noreferrer')
  })
})

describe('removeIsInStockButton', () => {
  test('removes the button from the DOM', () => {
    const wrapper = document.createElement('div')
    wrapper.id = 'isinstock-button'
    document.body.appendChild(wrapper)

    removeIsInStockButton()

    expect(document.querySelector('#isinstock-button')).toBeNull()
  })

  test('does nothing if button does not exist', () => {
    expect(() => removeIsInStockButton()).not.toThrow()
  })
})
