chrome.runtime.onMessage.addListener(({ action, value }, sender, sendResponse) => {
  if (action == "product") {
    document.body.innerHTML = JSON.stringify(value)
  }
})
