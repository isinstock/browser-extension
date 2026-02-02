import browser from 'webextension-polyfill'

import {MessageAction} from '../@types/messages'
import {ObservableElement} from '../@types/observables'
import ExclusiveValidationRequestCache from './exclusive-validation-request-cache'
import {observeSelector} from './observers'

export type ProductObserverCallback = (
  validationRequests: ExclusiveValidationRequestCache,
  productCandidates: ObservableElement[],
  containsProductCandidates: boolean,
) => boolean | Promise<boolean>

export function registerContentScript(
  selector: string,
  callback: ProductObserverCallback,
  options?: MutationObserverInit,
): void {
  const validationRequests = new ExclusiveValidationRequestCache()

  const {search, observe, disconnect} = observeSelector(
    selector,
    async (productCandidates: ObservableElement[], containsProductCandidates: boolean): Promise<boolean> => {
      return callback(validationRequests, productCandidates, containsProductCandidates)
    },
    options,
  )

  window.addEventListener('beforeunload', () => validationRequests.cancelAllRequests())
  window.addEventListener('focus', observe)
  window.addEventListener('blur', disconnect)
  window.addEventListener('pageshow', async event => {
    if (event.persisted) {
      console.debug('pageshow: Page was restored from cache.')
      search({event})
    } else {
      console.debug('pageshow: Page was loaded without cache.')
      observe()
      search({event})
    }
  })

  window.addEventListener('popstate', event => {
    console.debug('popstate: The popstate event is fired when the active history entry changes.')
    search({event})
  })

  browser.runtime.onMessage.addListener(((request: {action?: string}) => {
    if (request.action === MessageAction.URLChanged) {
      const event = new CustomEvent('urlChanged', {detail: {request}})
      search({event, filterFired: false})
    } else {
      console.debug('Unknown action', request.action)
    }
  }) as Parameters<typeof browser.runtime.onMessage.addListener>[0])
}
