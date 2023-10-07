import {ObservableElement} from '../@types/observables'

export const observeSelector = (
  selector: string,
  callback: (products: ObservableElement[]) => void,
  options: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['type'],
  },
): {observe: () => void; disconnect: () => void} => {
  const search = () => {
    const elements: ObservableElement[] = Array.from(document.querySelectorAll(selector))
    if (elements.length === 0) {
      return
    }

    const unfiredElements = elements
      .filter(element => !element.fired)
      .map(element => {
        element.fired = true
        return element
      })

    if (unfiredElements.length > 0) {
      callback(unfiredElements)
    } else {
      console.debug('Already fired on elements.')
    }
  }

  const observer = new MutationObserver(_mutations => {
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
  timeout: number
}

// TODO: Add a timeout to reject promise after N seconds
export const selectorAdded = ({selector, timeout = 5000}: SelectorAddedOptions): Promise<HTMLElement | null> => {
  const promise = new Promise<HTMLElement | null>((resolve, _reject) => {
    const observer = new MutationObserver(_mutations => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element) {
        observer.disconnect()

        resolve(element)
      }
    })

    console.log('Starting MutationObserver for selectorAdded', selector)
    const observerOptions: MutationObserverInit = {
      attributes: true,
      childList: true,
      subtree: true,
    }
    observer.observe(document, observerOptions)
  })

  const raceTimeout = new Promise<null>((resolve, _reject) => {
    setTimeout(() => resolve(null), timeout)
  })

  return Promise.race<HTMLElement | null>([promise, raceTimeout])
}
