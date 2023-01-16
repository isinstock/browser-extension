import {useAuth} from '../../hooks'

const LoggedOutView = () => {
  const {accessToken} = useAuth()

  return (
    <div class="action-window">
      <div class="action-content">
        <div class="grow">
          <img class="mx-auto h-12 w-auto" src="images/logos/isinstock.svg" />
          <h1 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Is In Stock</h1>
        </div>
        <div>
          <a
            href={`${ISINSTOCK_URL}/users/login?return_to=chrome-extension://jbokheigkkbbkonejaipdkhnbdefdegg/popup.html`}
            target="_blank"
            rel="noreferrer"
            class="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  )
}

export default LoggedOutView
