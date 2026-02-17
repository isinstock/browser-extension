const {context, analyzeMetafile} = require('esbuild')
const {copy} = require('esbuild-plugin-copy')
const postcss = require('postcss')
const fs = require('fs')
const tailwindcss = require('tailwindcss')
const autoprefixer = require('autoprefixer')

const isProduction = process.argv.includes('--production')
const isCI = process.env.CI === 'true'
const watch = process.argv.includes('--watch')
const isinstockUrl =
  process.env.ISINSTOCK_URL || (isProduction ? 'https://isinstock.com' : 'https://isinstock.localhost')

const copyChromeManifestPlugin = {
  name: 'copy-chrome-manifest',
  setup(build) {
    const options = build.initialOptions

    build.onEnd(async () => {
      const manifestPath = 'chrome/manifest.json'
      const destinationPath = `${options.outdir}/manifest.json`
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      manifest.version = pkg.version
      fs.writeFileSync(destinationPath, JSON.stringify(manifest, null, 2))
      console.log(`Copied ${manifestPath} to ${destinationPath}.`)
    })
  },
}

const copyFirefoxManifestPlugin = {
  name: 'copy-firefox-manifest',
  setup(build) {
    const options = build.initialOptions

    build.onEnd(async () => {
      const manifestPath = 'firefox/manifest.json'
      const destinationPath = `${options.outdir}/manifest.json`
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      manifest.version = pkg.version
      fs.writeFileSync(destinationPath, JSON.stringify(manifest, null, 2))
      console.log(`Copied ${manifestPath} to ${destinationPath}.`)
    })
  },
}

const cssAsStringPlugin = {
  name: 'css-as-string',
  setup(build) {
    build.onLoad({filter: /\.css$/}, async args => {
      const from = args.path
      const cssContent = await fs.promises.readFile(from, 'utf8')
      const result = await postcss([tailwindcss, autoprefixer]).process(cssContent, {from})
      return {
        contents: `export default ${JSON.stringify(result.css)}`,
        loader: 'js',
      }
    })
  },
}

const entryPoints = [
  './src/background.ts',
  './src/content_scripts/content_script.tsx',
  './src/content_scripts/amazon.tsx',
  './src/content_scripts/bestbuy.tsx',
  './src/content_scripts/isinstock_bridge.ts',
  './src/content_scripts/element_picker.tsx',
]

const config = {
  logLevel: 'info',
  metafile: true,
  entryPoints,
  bundle: true,
  sourcemap: !isProduction,
  minify: false,
  target: ['chrome120', 'edge120', 'firefox120', 'safari17'],
  define: {
    ISINSTOCK_URL: JSON.stringify(isinstockUrl),
    CHROME_EXTENSION_ID: '"bnglflgcpflggbpbcbpgeaknekceeojd"',
    CI: isCI ? 'true' : 'false',
    __DEV__: JSON.stringify(!isProduction),
  },
  drop: isProduction ? ['console'] : [],
  loader: {
    '.png': 'dataurl',
    '.svg': 'dataurl',
  },
  plugins: [cssAsStringPlugin],
}

async function main() {
  console.log('Build environment:')
  console.log(`  production: ${isProduction}`)
  console.log(`  __DEV__:    ${!isProduction}`)
  console.log(`  CI:         ${isCI}`)
  console.log(`  watch:      ${watch}`)
  console.log(`  sourcemap:  ${!isProduction}`)
  console.log(`  URL:        ${isinstockUrl}`)
  console.log()

  // Chrome
  const chromeCtx = await context({
    ...config,
    entryPoints: [...entryPoints, './src/sidepanel.tsx'],
    outdir: 'dist/chrome',
    plugins: [
      ...config.plugins,
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./public/**/*'],
          to: ['./dist/chrome'],
        },
      }),
      copyChromeManifestPlugin,
    ],
  })

  // Firefox
  const firefoxCtx = await context({
    ...config,
    outdir: 'dist/firefox',
    plugins: [
      ...config.plugins,
      copy({
        resolveFrom: 'cwd',
        assets: {
          from: ['./public/**/*'],
          to: ['./dist/firefox'],
        },
      }),
      copyFirefoxManifestPlugin,
    ],
  })

  if (watch) {
    await Promise.all([chromeCtx.watch(), firefoxCtx.watch()])
  } else {
    const [chromeResult, firefoxResult] = await Promise.all([chromeCtx.rebuild(), firefoxCtx.rebuild()])

    console.log('\n--- Chrome build ---')
    console.log(await analyzeMetafile(chromeResult.metafile))

    console.log('--- Firefox build ---')
    console.log(await analyzeMetafile(firefoxResult.metafile))

    chromeCtx.dispose()
    firefoxCtx.dispose()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
