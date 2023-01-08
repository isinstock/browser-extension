export const insertWidget = (html: string) => {
  let wrapper = document.querySelector<HTMLElement>("isinstock-widget")
  if (!wrapper) {
    wrapper = document.createElement("isinstock-widget")
    wrapper.attachShadow({mode: "open"})
    wrapper.style.position = "fixed"
    wrapper.style.zIndex = "999999"
    wrapper.style.bottom = "5px"
    wrapper.style.right = "5px"
    wrapper.style.backgroundColor = "#fff"
    wrapper.style.maxWidth = "500px"
    wrapper.style.maxHeight = "500px"
    wrapper.style.overflowY = "scroll"

    document.body.appendChild(wrapper)
  }

  if (wrapper.shadowRoot) {
    wrapper.shadowRoot.innerHTML = html
  }
}
