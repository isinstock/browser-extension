const LoginLink = () => {
  return (
    <a
      href={`${ISINSTOCK_URL}/users/login?return_to=chrome-extension://${CHROME_EXTENSION_ID}/popup.html`}
      target="_blank"
      rel="noreferrer"
      class="flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
      style="background-color: #00aae7; --tw-ring-color: #00aae7;"
      onMouseOver={e => (e.currentTarget.style.backgroundColor = '#6350e9')}
      onMouseOut={e => (e.currentTarget.style.backgroundColor = '#00aae7')}
    >
      Login
    </a>
  )
}

export default LoginLink
