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
