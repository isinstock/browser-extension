/** @type {import('jest-environment-puppeteer').JestPuppeteerConfig} */
const pathToExtension = 'dist/chrome'
module.exports = {
  launch: {
    headless: process.env.HEADLESS !== 'false' ? 'new' : false,
    product: 'chrome',
    args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`],
  },
  server: {
    command: 'node server.js',
    port: 3100,
    launchTimeout: 10000,
    debug: true,
  },
  browserContext: 'default',
}
