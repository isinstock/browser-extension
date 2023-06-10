chrome.runtime.onMessage.addListener(({action, value}, sender, sendResponse) => {
  if (action === 'product') {
    document.body.innerHTML = JSON.stringify(value)
  }
})

window.addEventListener('load', () => {
  const url = new URL(window.location.href)
  const accessToken = url.searchParams.get('access_token')

  chrome.storage.local.set({accessToken}, function () {
    console.log('accessToken saved')
  })
  chrome.storage.local.get(['accessToken']).then(result => {
    console.log(`Value currently is ${result.accessToken}`)
  })
})
