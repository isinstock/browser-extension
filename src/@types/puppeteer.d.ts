import type {JestPuppeteerGlobal} from 'jest-environment-puppeteer'

declare global {
  const browser: JestPuppeteerGlobal['browser']
  const page: JestPuppeteerGlobal['page']
  const context: JestPuppeteerGlobal['context']
  const puppeteerConfig: JestPuppeteerGlobal['puppeteerConfig']
  const jestPuppeteer: JestPuppeteerGlobal['jestPuppeteer']
}
