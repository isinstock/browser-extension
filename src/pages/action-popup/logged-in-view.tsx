import {useCallback, useEffect, useState} from 'preact/hooks'

import {InventorySubscription, InventorySubscriptionsResponse} from '../../@types/api'
import fetchApi from '../../utils/fetch-api'

const InventorySubscriptionsEmpty = () => {
  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="mx-auto h-12 w-12 text-gray-400"
      >
        <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
      </svg>

      <h3 class="mt-2 text-sm font-medium text-gray-900">No tracked products</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by first creating an alert for a product you're looking for.</p>
    </>
  )
}

const InventorySubscriptionsList = ({inventorySubscriptions}: {inventorySubscriptions: InventorySubscription[]}) => {
  if (inventorySubscriptions.length === 0) {
    return <InventorySubscriptionsEmpty />
  }

  console.log(inventorySubscriptions)
  return (
    <ul>
      {inventorySubscriptions.map(inventorySubscription => {
        return (
          <li>
            <a href="" class="block hover:bg-gray-50">
              <div class="flex items-center p-4 sm:px-6">
                <div class="flex min-w-0 flex-1 items-center">
                  <div class="flex h-12 w-12 shrink-0 items-center">
                    <img
                      src={inventorySubscription.product_variant.image.thumbnail}
                      alt=""
                      class="mx-auto aspect-auto"
                    />
                  </div>
                  <div class="min-w-0 flex-1 px-4">
                    <p class="truncate text-sm font-medium text-indigo-600">
                      {inventorySubscription.manufacture.name} - {inventorySubscription.product.name} -{' '}
                      {inventorySubscription.product_variant.name}
                    </p>
                    <p class="mt-1 text-sm text-gray-500">Created {inventorySubscription.created_at}</p>
                  </div>
                </div>
                <div class="flex space-x-4">
                  {inventorySubscription.disabled_at !== null ? (
                    <span class="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Disabled
                    </span>
                  ) : (
                    <span class="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Active
                    </span>
                  )}
                </div>
              </div>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

const Error = () => {
  return <span>My error</span>
}

const LoggedInView = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [inventorySubscriptions, setInventorySubscriptions] = useState<InventorySubscription[]>([])

  // TODO: Send DELETE request to /devices then on 200 OK do callback
  const logoutCallback = useCallback(() => {
    chrome.storage.local.set({accessToken: null})
  }, [])

  useEffect(() => {
    const fetchInventorySubscriptions = async () => {
      setLoading(true)
      setError(false)

      const response = await fetchApi('/api/inventory-subscriptions?state=enabled', 'GET')
      if (response.ok) {
        const json = (await response.json()) as InventorySubscriptionsResponse
        setInventorySubscriptions(json.results)
      } else {
        setError(true)
        setInventorySubscriptions([])
      }

      setLoading(false)
    }

    fetchInventorySubscriptions()
  }, [])

  return (
    <div class="action-window">
      <div class="action-content action-blankslate">
        <div class="grow">
          {loading ? (
            'Loading'
          ) : error ? (
            <Error />
          ) : (
            <InventorySubscriptionsList inventorySubscriptions={inventorySubscriptions} />
          )}
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
