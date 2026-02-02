import {vi} from 'vitest'

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getManifest: () => ({version: '1.0.0'}),
      onMessage: {addListener: vi.fn()},
      sendMessage: vi.fn(),
    },
    action: {
      setIcon: vi.fn(),
      onClicked: {addListener: vi.fn()},
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({accessToken: ''}),
        remove: vi.fn(),
      },
    },
    tabs: {
      create: vi.fn(),
      onRemoved: {addListener: vi.fn()},
      onUpdated: {addListener: vi.fn()},
    },
  },
}))
