import puppeteer, {PuppeteerLaunchOptions} from 'puppeteer'

const PUPPETEER_OPTIONS: PuppeteerLaunchOptions = {
  headless: 'new',
  product: 'chrome',
  slowMo: 50,
  args: [`--disable-extensions-except=dist/chrome`, `--load-extension=dist/chrome`],
}

export async function createBrowser() {
  if (process.env.CHROME_DEVTOOLS_ID !== undefined && process.env.CHROME_DEVTOOLS_ID !== '') {
    const browserWSEndpoint = `ws://host.docker.internal:21222/devtools/browser/${process.env.CHROME_DEVTOOLS_ID}`
    console.debug('Connecting with Chrome DevTools Protocol at %s', browserWSEndpoint)
    return puppeteer.connect({
      // Don't set any viewport and use the existing browser dimensions.
      defaultViewport: null,
      slowMo: 50,
      browserWSEndpoint,
    })
  }

  console.debug('Launching new %s browser at %s', PUPPETEER_OPTIONS.product, PUPPETEER_OPTIONS.executablePath)
  return puppeteer.launch(PUPPETEER_OPTIONS)
}
