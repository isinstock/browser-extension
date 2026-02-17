import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from '@sentry/browser'

let scope: Scope | undefined

/**
 * Initialize a scoped Sentry client for a specific extension context.
 * Uses BrowserClient directly to avoid polluting global state — critical
 * for content scripts that share the page's JS environment.
 *
 * When SENTRY_DSN is empty (e.g. local dev without the env var), the
 * client is never created and all capture calls are silent no-ops.
 */
export function initSentry(context: string) {
  if (!SENTRY_DSN) return

  const integrations = getDefaultIntegrations({}).filter(i => {
    // These integrations install global handlers or modify browser APIs,
    // which would interfere with the host page in content scripts.
    return ![
      'GlobalHandlers',
      'Breadcrumbs',
      'BrowserApiErrors',
      'BrowserSession',
      'HttpContext',
    ].includes(i.name)
  })

  const client = new BrowserClient({
    dsn: SENTRY_DSN,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations,
  })

  scope = new Scope()
  scope.setClient(client)
  scope.setTag('context', context)

  client.init()
}

export function captureException(error: unknown) {
  scope?.captureException(error)
}

export function captureMessage(message: string) {
  scope?.captureMessage(message)
}
