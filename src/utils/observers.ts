import {ObservableElement} from '../@types/observables'

/**
 * Callback function for the product observer.
 * @param productCandidates - An array of ObservableElement objects representing elements which are candidates for containing a product.
 * @param containsProductCandidates - A boolean indicating whether there are any potential eligible products on the page.
 */
type ProductObserverCallback = (productCandidates: ObservableElement[], elgible: boolean) => void

interface SearchOptions {
  // Control if elements are filtered that have had their callback fired.
  filterFired?: boolean
  event?: PageTransitionEvent | PopStateEvent | CustomEvent
}

type ObserveSelectorResult = {
  search: (options?: SearchOptions) => void
  observe: () => void
  disconnect: () => void
}

export const observeSelector = (
  selector: string,
  callback: ProductObserverCallback,
  options: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
    // Only observe changes to attributes that are relevant to Linked Data, RDFa, and Microdata
    attributeFilter: ['type', 'itemtype', 'typeof'],
  },
): ObserveSelectorResult => {
  const search = ({event, filterFired = true}: SearchOptions = {}) => {
    console.group('observeSelector: search')

    const elements: ObservableElement[] = Array.from(document.querySelectorAll(selector))
    console.debug(`Triggered by ${event ? event.type : 'unknown'} event`)
    if (elements.length === 0) {
      console.debug(`Selector matched ${elements.length} element(s)`)
      console.groupEnd()
      callback([], elements.length > 0)
      return
    }

    const unfiredElements = elements
      .filter(element => !filterFired || !element.fired)
      .map(element => {
        element.fired = true
        return element
      })

    if (unfiredElements.length > 0) {
      console.debug(`Selector matched ${elements.length} element(s) that have not had their callback fired.`)
      callback(unfiredElements, elements.length > 0)
    } else {
      console.debug(`Selector matched ${elements.length} element(s), but they have already had their callback fired.`)
    }
    console.groupEnd()
  }

  const observer = new MutationObserver((mutations: MutationRecord[], _observer: MutationObserver) => {
    for (const mutation of mutations) {
      // If the mutation is a change to an attribute, and the attribute is one of the ones we are observing, and the element is a candidate, search for products.
      if (mutation.type === 'attributes' && mutation.target instanceof Element && mutation.target.matches(selector)) {
        const event = new CustomEvent('attributesMutated', {detail: {selector}})
        search({event})
        continue
      }

      // If the mutation is a change to an attribute, and the attribute is one of the ones we are observing, and the element is a candidate, search for products.
      if (mutation.type === 'childList' && mutation.target instanceof Element && mutation.target.matches(selector)) {
        const event = new CustomEvent('matchedSelector', {detail: {selector}})
        search({event})
        continue
      }

      // If the mutation contains list of addedNodes
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        const event = new CustomEvent('addedNodes', {detail: {selector}})
        search({event})
        continue
      }
    }
  })

  const observe = () => {
    console.debug('observeSelector: 🔍 Starting MutationObserver for selector', selector)
    observer.observe(document, options)
  }

  const disconnect = () => {
    console.debug('observeSelector: 🛑 Disconnecting MutationObserver for selector', selector)
    observer.disconnect()
  }

  return {search, observe, disconnect}
}
