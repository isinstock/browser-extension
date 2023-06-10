import LoginLink from '../../components/login-link'

const LoggedOutView = () => {
  return (
    <div class="action-window">
      <div class="action-content">
        <div class="grow">
          <img class="mx-auto h-12 w-auto" src="images/logos/isinstock.svg" />
          <h1 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Is In Stock</h1>
        </div>
        <div>
          <LoginLink />
        </div>
      </div>
    </div>
  )
}

export default LoggedOutView
