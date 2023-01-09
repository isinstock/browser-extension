import { Product } from "../@types/linked-data"
import { searchProducts } from "./products"

export const observeProducts = (
  productCallback: (product: Product) => void,
  options: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
  }
): { observe: () => void, disconnect: () => void } => {
  const observer = new MutationObserver(mutations => searchProducts({ productCallback }))
  const observe = () => {
    console.log("Starting MutationObserver")
    observer.observe(document, options)
  }

  const disconnect = () => {
    console.log("Disconnecting MutationObserver")
    observer.disconnect()
  }


  return { observe, disconnect }
}

// TODO: Add a timeout to reject promise after N seconds
export const selectorAdded = (
  selector: string,
  options: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
  }
): Promise<HTMLElement> => {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(mutations => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element) {
        observer.disconnect()

        resolve(element)
      }
    })

    console.log("Starting MutationObserver for selectorAdded", selector)
    observer.observe(document, options)
  })
}
