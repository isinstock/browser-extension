import browser from 'webextension-polyfill'

export async function setBrowserExtensionInstallToken(browserExtensionInstallToken: string) {
  await browser.storage.sync.set({browserExtensionInstallToken})
}

export async function getBrowserExtensionInstallToken(): Promise<string> {
  const {browserExtensionInstallToken} = await browser.storage.sync.get({
    browserExtensionInstallToken: '',
  })

  return browserExtensionInstallToken
}
