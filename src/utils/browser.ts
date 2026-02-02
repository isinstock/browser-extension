import {type LaunchOptions, connect, launch} from 'puppeteer'

const PUPPETEER_OPTIONS: LaunchOptions = {
  headless: true,
  slowMo: 50,
  args: [`--disable-extensions-except=dist/chrome`, `--load-extension=dist/chrome`],
}

export async function createBrowser() {
  if (process.env.CHROME_DEVTOOLS_ID !== undefined && process.env.CHROME_DEVTOOLS_ID !== '') {
    const browserWSEndpoint = `ws://host.docker.internal:21222/devtools/browser/${process.env.CHROME_DEVTOOLS_ID}`
    console.debug('Connecting with Chrome DevTools Protocol at %s', browserWSEndpoint)
    return connect({
      // Don't set any viewport and use the existing browser dimensions.
      defaultViewport: null,
      slowMo: 50,
      browserWSEndpoint,
    })
  }

  console.debug('Launching new browser')
  return launch(PUPPETEER_OPTIONS)
}
