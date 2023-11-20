/** @type {import('jest-environment-puppeteer').JestPuppeteerConfig} */
const pathToExtension = 'dist/chrome'
module.exports = {
  launch: {
    headless: process.env.HEADLESS !== 'false' ? 'new' : false,
    product: 'chrome',
    args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`],
  },
  browserContext: 'default',
}
