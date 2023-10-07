import {render} from 'preact'

import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import {UserProvider} from '../contexts/user-context'

const inStockAvailability = ['InStock', 'InStoreOnly', 'LimitedAvailability', 'OnlineOnly', 'PreSale', 'PreOrder']

const isInStock = (itemAvailability: string): boolean => {
  return inStockAvailability.some(
    candidate => candidate.localeCompare(itemAvailability, undefined, {sensitivity: 'accent'}) === 0,
  )
}

type IsInStockButtonProps = {
  productValidation: ProductValidationResponse
}

const IsInStockButton = ({productValidation}: IsInStockButtonProps) => {
  if (productValidation.result !== ProductValidationResult.Supported) {
    return <></>
  }

  if (productValidation.availability !== undefined && isInStock(productValidation.availability)) {
    return (
      <a href={productValidation.track_url} target="_blank" class="btn" rel="noreferrer">
        <img
          class="isinstock-logo"
          width="16"
          height="16"
          src={chrome.runtime.getURL('images/inventory-states/available.svg')}
        />
        <span>In Stock</span>
      </a>
    )
  }

  return (
    <a href={productValidation.track_url} target="_blank" class="btn" rel="noreferrer">
      <img
        class="isinstock-logo"
        width="16"
        height="16"
        src={chrome.runtime.getURL('images/inventory-states/unavailable.svg')}
      />
      <span>Notify Me</span>
    </a>
  )
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
  let wrapper = document.querySelector<HTMLElement>('#isinstock-button')
  let shadowRoot = wrapper?.shadowRoot
  const app = (
    <UserProvider>
      <IsInStockButton productValidation={productValidation} />
    </UserProvider>
  )
  if (wrapper) {
    shadowRoot = wrapper.shadowRoot as ShadowRoot
    render(app, shadowRoot)
  } else {
    wrapper = document.createElement('div')
    wrapper.id = 'isinstock-button'
    wrapper.style.position = 'fixed'
    wrapper.style.bottom = '10px'
    wrapper.style.right = '10px'
    wrapper.style.zIndex = '999999'
    shadowRoot = wrapper.attachShadow({mode: 'open'})

    // Can we prevent any flashing?
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = chrome.runtime.getURL('elements/isinstock-button/style.css')
    shadowRoot.appendChild(stylesheet)

    document.body.appendChild(wrapper)

    render(app, shadowRoot)
  }

  return wrapper
}
