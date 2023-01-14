# Content Scripts

There are a few ways to detect a product within a content script:

1. Listening to tab URL changes

```ts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === MessageAction.URLChanged) {
    console.log('URL changed to', request.url)
  } else {
    console.log('Unknown action', request.action)
  }
})
```

2. When relying on product schema detection, using the MutationObserver

```ts
// Detect page transitions or DOM changes for single page based applications.
const {observe, disconnect} = observeProducts(productCallback)

const run = (runLoaded?: boolean) => {
  locateProducts({runLoaded, productCallback, notFoundCallback})
  observe()
}

// Run product location on page load
run()

// Once user leaves the page, disconnect the MutationObserver until user returns to tab.
window.addEventListener('blur', disconnect)

// Once user returns to the page, start the MutationObserver again and re-process page for updated chrome action icon.
window.addEventListener('focus', () => {
  run(true)
})
```
