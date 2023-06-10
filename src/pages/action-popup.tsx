import {render} from 'preact'

import {useAuth} from '../hooks'
import LoggedInView from './action-popup/logged-in-view'
import LoggedOutView from './action-popup/logged-out-view'

chrome.runtime.onMessage.addListener(({action, value}, sender, sendResponse) => {
  if (action === 'product') {
    document.body.innerHTML = JSON.stringify(value)
  }
})

const App = () => {
  const {isLoggedIn} = useAuth()
  if (isLoggedIn) {
    return <LoggedInView />
  }

  return <LoggedOutView />
}

window.addEventListener('DOMContentLoaded', () => {
  const url = new URL(window.location.href)
  const accessToken = url.searchParams.get('access_token')

  if (accessToken !== null && accessToken !== '') {
    chrome.storage.local.set({accessToken}, function () {
      console.log('accessToken saved')
    })
  }

  render(<App />, document.body)
})
