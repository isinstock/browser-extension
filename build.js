const build = require('esbuild').build
const copy = require('esbuild-plugin-copy').copy
const postCssPlugin = require('esbuild-style-plugin')
const pkg = require('./package.json')
const fs = require('fs')

const isProduction = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const copyChromeManifestPlugin = {
  name: 'copy-chrome-manifest',
  setup(build) {
    const options = build.initialOptions

    build.onEnd(async () => {
      const dest = `${options.outdir}/manifest.json`
      fs.copyFileSync('chrome/manifest.json', dest)
      console.log(`Copied chrome/manifest.json to ${dest}.`)
    })
  },
}

const copyFirefoxManifestPlugin = {
  name: 'copy-firefox-manifest',
  setup(build) {
    const options = build.initialOptions

    build.onEnd(async () => {
      const dest = `${options.outdir}/manifest.json`
      fs.copyFileSync('firefox/manifest.json', dest)
      console.log(`Copied firefox/manifest.json to ${dest}.`)
    })
  },
}

// Chrome
build({
  logLevel: 'info',
  entryPoints: [
    './src/background.ts',
    './src/content_scripts/content_script.tsx',
    './src/elements/isinstock-button/style.css',
  ],
  outdir: 'dist/chrome',
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
  plugins: [
    postCssPlugin({
      postcss: {
        plugins: [require('tailwindcss'), require('autoprefixer')],
      },
    }),
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
  logLevel: 'info',
  entryPoints: [
    './src/background.ts',
    './src/content_scripts/content_script.tsx',
    './src/elements/isinstock-button/style.css',
  ],
  outdir: 'dist/firefox',
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
  plugins: [
    postCssPlugin({
      postcss: {
        plugins: [require('tailwindcss'), require('autoprefixer')],
      },
    }),
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
