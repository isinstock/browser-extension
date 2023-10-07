import {ObservableElement} from '../@types/observables'

export const observeSelector = (
  selector: string,
  callback: (element: ObservableElement) => void,
  options: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['type'],
  },
): {observe: () => void; disconnect: () => void} => {
  const search = () => {
    const elements: NodeListOf<ObservableElement> = document.querySelectorAll(selector)
    for (const element of elements) {
      if (!element.fired) {
        element.fired = true
        callback(element)
      } else {
        console.debug('Already fired on', element)
      }
    }
  }

  const observer = new MutationObserver(mutations => {
    search()
  })

  const observe = () => {
    console.debug('Starting MutationObserver for selector', selector)
    observer.observe(document, options)
  }

  const disconnect = () => {
    console.debug('Disconnecting MutationObserver for selector', selector)
    observer.disconnect()
  }

  return {observe, disconnect}
}

type SelectorAddedOptions = {
  selector: string
  timeout?: number
}

// TODO: Add a timeout to reject promise after N seconds
export const selectorAdded = (options: SelectorAddedOptions): Promise<HTMLElement | null> => {
  const promise = new Promise<HTMLElement | null>((resolve, reject) => {
    const observer = new MutationObserver(mutations => {
      const element = document.querySelector<HTMLElement>(options.selector)
      if (element) {
        observer.disconnect()

        resolve(element)
      }
    })

    console.log('Starting MutationObserver for selectorAdded', options.selector)
    const observerOptions: MutationObserverInit = {
      attributes: true,
      childList: true,
      subtree: true,
    }
    observer.observe(document, observerOptions)
  })

  if (options.timeout) {
    const timeout = new Promise<null>((resolve, reject) => {
      setTimeout(() => resolve(null), options.timeout)
    })

    return Promise.race<HTMLElement | null>([promise, timeout])
  }
  return promise
}
