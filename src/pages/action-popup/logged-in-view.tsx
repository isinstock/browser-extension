import {useCallback} from 'preact/hooks'

const LoggedInView = () => {
  // TODO: Send DELETE request to /devices then on 200 OK do callback
  const logoutCallback = useCallback(() => {
    chrome.storage.local.set({accessToken: null})
  }, [])

  return (
    <div class="action-window">
      <div class="action-content action-blankslate">
        <div class="grow">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="mx-auto h-12 w-12 text-gray-400"
          >
            <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
          </svg>

          <h3 class="mt-2 text-sm font-medium text-gray-900">No tracked products</h3>
          <p class="mt-1 text-sm text-gray-500">
            Get started by first creating an alert for a product you're looking for.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={logoutCallback}
            class="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoggedInView
