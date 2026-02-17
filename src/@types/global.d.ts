declare const ISINSTOCK_URL: string
declare const CHROME_EXTENSION_ID: string
declare const CI: boolean
declare const SENTRY_DSN: string

declare module '*.css' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}
