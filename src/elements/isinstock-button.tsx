import {render} from 'preact'
import {useEffect} from 'preact/hooks'

import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {UserProvider} from '../contexts/user-context'
import {extensionApi} from '../utils/extension-api'
import fetchApi from '../utils/fetch-api'
import {broadcastInventoryState, isInStock} from '../utils/inventory-state'

type IsInStockButtonProps = {
  productValidation: ProductValidationResponse
}

const IsInStockButton = ({productValidation}: IsInStockButtonProps) => {
  useEffect(() => {
    const handleBroadcastInventoryState = () => {
      broadcastInventoryState(InventoryStateNormalized.Available)
    }

    handleBroadcastInventoryState()
    window.addEventListener('focus', handleBroadcastInventoryState)

    return () => {
      window.removeEventListener('focus', handleBroadcastInventoryState)
    }
  }, [])

  return (
    <a
      href={productValidation.track_url}
      target="_blank"
      class="btn"
      rel="noreferrer"
      data-inventory-state-normalized={InventoryStateNormalized.Available}
    >
      <img
        class="isinstock-logo"
        width="16"
        height="16"
        src={extensionApi.runtime.getURL('images/inventory-states/available.svg')}
      />
      <span>In Stock</span>
    </a>
  )
}

const OutOfStockButton = ({productValidation}: IsInStockButtonProps) => {
  useEffect(() => {
    const handleBroadcastInventoryState = () => {
      broadcastInventoryState(InventoryStateNormalized.Unavailable)
    }

    handleBroadcastInventoryState()
    window.addEventListener('focus', handleBroadcastInventoryState)

    return () => {
      window.removeEventListener('focus', handleBroadcastInventoryState)
    }
  }, [])

  return (
    <a
      href={productValidation.track_url}
      target="_blank"
      class="btn"
      rel="noreferrer"
      data-inventory-state-normalized={InventoryStateNormalized.Unavailable}
    >
      <img
        class="isinstock-logo"
        width="16"
        height="16"
        src={extensionApi.runtime.getURL('images/inventory-states/unavailable.svg')}
      />
      <span>Notify Me When Available</span>
    </a>
  )
}

const UnsupportedButton = ({productValidation}: IsInStockButtonProps) => {
  useEffect(() => {
    const handleBroadcastInventoryState = () => {
      broadcastInventoryState(InventoryStateNormalized.Unknown)
    }

    handleBroadcastInventoryState()
    window.addEventListener('focus', handleBroadcastInventoryState)

    return () => {
      window.removeEventListener('focus', handleBroadcastInventoryState)
    }
  }, [])

  return (
    <a
      href={productValidation.track_url}
      target="_blank"
      className="btn"
      rel="noreferrer"
      data-inventory-state-normalized={InventoryStateNormalized.Unknown}
    >
      <img
        className="isinstock-logo"
        width="16"
        height="16"
        src={extensionApi.runtime.getURL('images/inventory-states/unknown.svg')}
      />
      <span>Not Trackable</span>
    </a>
  )
}

const ProductValidationButton = ({productValidation}: IsInStockButtonProps) => {
  if (productValidation.result === ProductValidationResult.Error) {
    return <></>
  }

  if (productValidation.result === ProductValidationResult.Unsupported) {
    return <UnsupportedButton productValidation={productValidation} />
  }

  if (productValidation.availability !== undefined && isInStock(productValidation.availability)) {
    return <IsInStockButton productValidation={productValidation} />
  }

  return <OutOfStockButton productValidation={productValidation} />
}

interface InsertIsInStockButtonOptions {
  productValidation: ProductValidationResponse
}

export const removeIsInStockButton = () => {
  const wrapper = document.querySelector<HTMLElement>('#isinstock-button')
  if (wrapper) {
    wrapper.remove()
  }
}

export const insertIsInStockButton = ({productValidation}: InsertIsInStockButtonOptions): HTMLElement => {
  console.log('insert!')
  let wrapper = document.querySelector<HTMLElement>('#isinstock-button')
  let shadowRoot = wrapper?.shadowRoot
  const app = (
    <UserProvider>
      <ProductValidationButton productValidation={productValidation} />
    </UserProvider>
  )
  if (wrapper) {
    shadowRoot = wrapper.shadowRoot as ShadowRoot
    render(app, shadowRoot)
  } else {
    wrapper = document.createElement('div')
    wrapper.id = 'isinstock-button'
    // The maximum value of a 32 bits integer
    wrapper.style.zIndex = '2147483647'
    // If a parent stylesheet contains div:empty due to the shadow root the container will not appear.
    wrapper.style.display = 'block'
    shadowRoot = wrapper.attachShadow({mode: 'open'})

    // Can we prevent any flashing?
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = extensionApi.runtime.getURL('elements/isinstock-button/style.css')
    shadowRoot.appendChild(stylesheet)
    console.log(productValidation)

    if (productValidation.selectors !== undefined) {
      const innerWrapper = wrapper
      const matchedSelector = productValidation.selectors.find(({selector, insert}) => {
        const element = document.querySelector(selector)
        if (!element) {
          return false
        }

        let child: HTMLElement
        if (insert === 'after') {
          innerWrapper.style.marginTop = '10px'
          child = element.nextElementSibling as HTMLElement
        } else {
          innerWrapper.style.marginBottom = '10px'
          child = element.previousElementSibling as HTMLElement
        }
        element.parentNode?.insertBefore(innerWrapper, child)

        return innerWrapper.isConnected
      })

      if (matchedSelector) {
        console.debug('Matched with', matchedSelector)
        const body = JSON.stringify({
          selector: matchedSelector.selector,
        })

        // Async call to the API to increment the selector's counter
        fetchApi('/api/retailers/selectors/validate', 'POST', body)
      } else {
        console.debug('No selectors matched')
      }
    }

    if (wrapper.isConnected) {
      console.debug('Inserted at a matching selector')
    } else {
      console.debug("Couldn't find a matching selector, inserting at the bottom right of the page")

      wrapper.style.position = 'fixed'
      wrapper.style.bottom = '10px'
      wrapper.style.right = '10px'
      document.body.appendChild(wrapper)
    }

    render(app, shadowRoot)
  }

  return wrapper
}
