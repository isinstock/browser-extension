const {context} = require('esbuild')
const {copy} = require('esbuild-plugin-copy')
const postcss = require('postcss')
const fs = require('fs')
const tailwindcss = require('tailwindcss')
const autoprefixer = require('autoprefixer')

const isProduction = process.argv.includes('--production')
const isCI = process.env.CI === 'true'
const watch = process.argv.includes('--watch')

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
]

const config = {
  logLevel: 'info',
  entryPoints,
  bundle: true,
  sourcemap: !isProduction,
  minify: isProduction,
  target: ['chrome120', 'edge120', 'firefox120', 'safari17'],
  define: {
    ISINSTOCK_URL: isProduction ? '"https://isinstock.com"' : '"http://localhost:3000"',
    CHROME_EXTENSION_ID: '"bnglflgcpflggbpbcbpgeaknekceeojd"',
    CI: isCI ? 'true' : 'false',
  },
  drop: isProduction ? ['console'] : [],
  loader: {
    '.png': 'dataurl',
    '.svg': 'dataurl',
  },
  plugins: [cssAsStringPlugin],
}

async function main() {
  // Chrome
  const chromeCtx = await context({
    ...config,
    entryPoints: [...entryPoints, './src/sidepanel.ts'],
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
    await Promise.all([chromeCtx.rebuild(), firefoxCtx.rebuild()])
    chromeCtx.dispose()
    firefoxCtx.dispose()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
