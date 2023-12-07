import {render} from 'preact'
import {useEffect} from 'preact/hooks'

import availableImg from '../../public/images/inventory-states/available.svg'
import unavailableImg from '../../public/images/inventory-states/unavailable.svg'
import unknownImg from '../../public/images/inventory-states/unknown.svg'
import {ProductValidationResponse, ProductValidationResult} from '../@types/api'
import {InventoryStateNormalized} from '../@types/inventory-states'
import {UserProvider} from '../contexts/user-context'
import fetchApi from '../utils/fetch-api'
import {broadcastInventoryState, isInStock} from '../utils/inventory-state'
import styles from './isinstock-button/style.css'

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
      data-inventory-state={productValidation.availability}
      data-inventory-state-normalized={InventoryStateNormalized.Available}
    >
      <img class="isinstock-logo" width="16" height="16" src={availableImg} />
      <span>{productValidation.availability === 'PreOrder' ? 'Pre-Order' : 'In Stock'}</span>
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
      data-inventory-state={productValidation.availability}
      data-inventory-state-normalized={InventoryStateNormalized.Unavailable}
    >
      <img class="isinstock-logo" width="16" height="16" src={unavailableImg} />
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
      <img className="isinstock-logo" width="16" height="16" src={unknownImg} />
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
  wrapper?.remove()
}

export const insertIsInStockButton = ({productValidation}: InsertIsInStockButtonOptions): HTMLElement => {
  let wrapper = document.querySelector<HTMLElement>('#isinstock-button')
  // If there is an existing button, remove it
  wrapper?.remove()

  const app = (
    <UserProvider>
      <ProductValidationButton productValidation={productValidation} />
    </UserProvider>
  )

  wrapper = document.createElement('div')
  wrapper.innerHTML = '&nbsp;'
  wrapper.id = 'isinstock-button'
  wrapper.style.display = 'block'
  wrapper.style.opacity = '1'
  const shadowRoot = wrapper.attachShadow({mode: 'open'})

  // Can we prevent any flashing?
  const stylesheet = document.createElement('style')
  stylesheet.textContent = styles
  shadowRoot.appendChild(stylesheet)

  const selectors = productValidation.selectors ?? []
  const innerWrapper = wrapper
  const matchedSelector = selectors.find(({selector, insert}) => {
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
    console.debug(
      'insertIsInStockButton: Inserting `%s` selector `%s`',
      matchedSelector.insert,
      matchedSelector.selector,
    )
    const body = JSON.stringify({
      selector: matchedSelector.selector,
    })

    // Async call to the API to increment the selector's counter
    fetchApi('/api/retailers/selectors/validate', 'POST', body)
  } else {
    console.debug("insertIsInStockButton: Couldn't find a matching selector, inserting at the bottom right of the page")

    wrapper.style.position = 'fixed'
    // The maximum value of a 32 bits integer
    wrapper.style.zIndex = '2147483647'
    wrapper.style.bottom = '10px'
    wrapper.style.right = '10px'
    document.body.appendChild(wrapper)
  }

  render(app, shadowRoot)

  return wrapper
}
