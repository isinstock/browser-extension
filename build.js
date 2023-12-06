const build = require('esbuild').build
const copy = require('esbuild-plugin-copy').copy
const postcss = require('postcss')
const pkg = require('./package.json')
const fs = require('fs')
const tailwindcss = require('tailwindcss')
const autoprefixer = require('autoprefixer')

const isProduction = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const copyChromeManifestPlugin = {
  name: 'copy-chrome-manifest',
  setup(build) {
    const options = build.initialOptions

    build.onEnd(async () => {
      const manifestPath = 'chrome/manifest.json'
      const destinationPath = `${options.outdir}/manifest.json`
      const package = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      manifest.version = package.version
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
      const package = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      manifest.version = package.version
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

const config = {
  logLevel: 'info',
  entryPoints: ['./src/background.ts', './src/content_scripts/content_script.tsx', './src/content_scripts/amazon.tsx'],
  bundle: true,
  sourcemap: !isProduction,
  watch,
  minify: isProduction,
  target: ['ios15', 'chrome100', 'edge100', 'firefox100', 'safari15'],
  define: {
    VERSION: `"${pkg.version}"`,
    ISINSTOCK_URL: isProduction ? '"https://isinstock.com"' : '"http://localhost:3000"',
    CHROME_EXTENSION_ID: '"bnglflgcpflggbpbcbpgeaknekceeojd"',
  },
  drop: isProduction ? ['console'] : [],
  loader: {
    '.png': 'dataurl',
    '.svg': 'dataurl',
  },
  plugins: [cssAsStringPlugin],
}

// Chrome
build({
  ...config,
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
build({
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
