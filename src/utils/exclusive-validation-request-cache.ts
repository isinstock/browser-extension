import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import fetchApi from './fetch-api'

export type FetchFn = (
  path: string,
  method: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE',
  body?: BodyInit | null | undefined,
  signal?: AbortSignal | null | undefined,
) => Promise<Response>

// The extension can trigger validation requests in many ways, and we cannot always guarantee that only one request is
// in flight at a time. This cache ensures that only one request is in flight for a given URL at a time, and that
// duplicate requests receive the same response as the original request.
export default class ExclusiveValidationRequestCache {
  private cache: Record<string, Promise<any> | undefined> = {}
  private controllers: Record<string, AbortController> = {}

  constructor(private fetchFn: FetchFn = fetchApi) {}

  async fetchWithLock(url: string, callback: (data: ProductValidationResponse) => void): Promise<void> {
    const controller = new AbortController()
    const signal = controller.signal
    let inFlightRequest = this.cache[url]

    if (inFlightRequest) {
      console.debug(`ExclusiveValidationRequestCache: Request in flight for ${url}`)
    } else {
      inFlightRequest = this.fetchFn('/api/products/validations', 'POST', JSON.stringify({url}), signal)
        .then(async response => {
          delete this.cache[url]
          delete this.controllers[url]
          let productValidationResponse: ProductValidationResponse = {
            result: ProductValidationResult.Unsupported,
          }
          if (response.ok) {
            productValidationResponse = await response.json()
          }
          return productValidationResponse
        })
        .catch(error => {
          delete this.cache[url]
          delete this.controllers[url]
          throw error
        })

      this.cache[url] = inFlightRequest
      this.controllers[url] = controller
    }

    inFlightRequest!.then(callback).catch(error => console.error(error))
  }

  cancelAllRequests() {
    for (const url in this.controllers) {
      this.controllers[url]!.abort()
      delete this.cache[url]
      delete this.controllers[url]
    }
  }
}
