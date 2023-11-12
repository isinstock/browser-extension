import {render} from 'preact'
import {useEffect} from 'preact/hooks'

import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {UserProvider} from '../contexts/user-context'
import {extensionApi} from '../utils/extension-api'
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
      <span>Notify Me</span>
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
    // If a parent stylesheet contains div:empty due to the shadow root the container will not appear.
    wrapper.style.display = 'block'
    shadowRoot = wrapper.attachShadow({mode: 'open'})

    // Can we prevent any flashing?
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = extensionApi.runtime.getURL('elements/isinstock-button/style.css')
    shadowRoot.appendChild(stylesheet)

    // Find all buttons on the page
    const buttons = Array.from<HTMLElement>(document.querySelectorAll('form button, button'))
    const keywords = ['Add To Cart', 'Buy Now', 'Sold Out', 'Out of Stock', 'Pre Order']

    // Filter the buttons to get only those that contain keywords
    const matchingButtons = buttons.filter(button => {
      console.debug('Considering', button)
      return containsKeyword(button, keywords)
    })

    console.debug(matchingButtons)
    // Check if there are multiple matching buttons before inserting the "Notify Me When Available" button
    if (matchingButtons.length === 1) {
      // Add event listeners and functionality to the notifyButton
      // Insert notifyButton after the matching button in the DOM
      wrapper.style.marginTop = '10px'

      matchingButtons[0].parentNode.insertBefore(wrapper, matchingButtons[0].nextSibling)
    } else {
      if (matchingButtons.length > 1) {
        console.debug('Matched many buttons', matchingButtons, 'containing', keywords)
      } else {
        console.debug('Did not find a place to insert button')
      }

      wrapper.style.position = 'fixed'
      wrapper.style.bottom = '10px'
      wrapper.style.right = '10px'
      // The maximum value of a 32 bits integer
      wrapper.style.zIndex = '2147483647'

      document.body.appendChild(wrapper)
    }

    render(app, shadowRoot)
  }

  return wrapper
}

// Function to check if an element's text content contains any of the keywords (case-insensitive)
function containsKeyword(element: HTMLElement, keywords: string[]): boolean {
  if (element.textContent === null) {
    return false
  }

  const text = element.textContent.toLowerCase()

  return keywords.some(keyword => text.includes(keyword.toLowerCase()))
}
