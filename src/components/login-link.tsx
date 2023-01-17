import {ISINSTOCK_URL} from '../utils/config'

const LoginLink = () => {
  return (
    <a
      href={`${ISINSTOCK_URL}/users/login?return_to=chrome-extension://jbokheigkkbbkonejaipdkhnbdefdegg/popup.html`}
      target="_blank"
      rel="noreferrer"
      class="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      Login
    </a>
  )
}

export default LoginLink
