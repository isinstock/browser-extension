import { InventoryState } from "../@types/inventory-states"

export function insertIsInStockButton(element: HTMLElement, { insertPosition = "afterend", inventoryState = InventoryState.Unknown }: { insertPosition?: InsertPosition, inventoryState?: InventoryState }): HTMLElement {
  let existingButton = document.querySelector<HTMLElement>("isinstock-button")
  if (existingButton) {
    return existingButton
  }

  const button = document.createElement("isinstock-button")
  button.attachShadow({ mode: "open" })
  button.style.backgroundColor = "#fff"
  button.style.maxWidth = "500px"
  button.style.fontSize = "16px"
  button.style.display = "block"

  const stylesheet = document.createElement("link")
  stylesheet.rel = "stylesheet"
  stylesheet.href = chrome.runtime.getURL('css/elements/isinstock-button/style.css')
  button.shadowRoot?.appendChild(stylesheet)

  const details = document.createElement("details")
  details.dataset.inventoryState = inventoryState

  const summary = document.createElement("summary")
  summary.ariaHasPopup = "menu"
  summary.ariaExpanded = "false"
  summary.role = "button"
  details.appendChild(summary)

  const detailsMenu = document.createElement("details-menu")
  detailsMenu.role = "button"
  detailsMenu.innerHTML = "Some menu"
  details.appendChild(detailsMenu)

  const image = document.createElement("img")
  image.classList.add("isinstock-logo")
  const span = document.createElement("span")
  switch (inventoryState) {
    case InventoryState.IsInStock:
      image.src = chrome.runtime.getURL('images/inventory-states/available/128.png')
      span.innerText = "Check nearby stores"

      break;

    case InventoryState.NotInStock:
      image.src = chrome.runtime.getURL('images/inventory-states/unavailable/128.png')
      span.innerText = "Check nearby stores"
      break;

    default:
      image.src = chrome.runtime.getURL('images/inventory-states/unknown/128.png')
      span.innerText = "Check nearby stores"
      break;
  }

  summary.appendChild(image)
  summary.appendChild(span)

  button.shadowRoot?.appendChild(details)

  element.insertAdjacentElement(insertPosition, button)

  return button
}
