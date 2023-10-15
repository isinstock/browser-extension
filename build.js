const build = require('esbuild').build
const copy = require('esbuild-plugin-copy').copy
const postCssPlugin = require('esbuild-style-plugin')
const pkg = require('./package.json')

const isProduction = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

build({
  logLevel: 'info',
  entryPoints: [
    './src/background.ts',
    './src/content_scripts/content_script.tsx',
    './src/elements/isinstock-button/style.css',
  ],
  outdir: 'dist',
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
      // this is equal to process.cwd(), which means we use cwd path as base path to resolve `to` path
      // if not specified, this plugin uses ESBuild.build outdir/outfile options as base path.
      resolveFrom: 'cwd',
      assets: {
        from: ['./public/**/*'],
        to: ['./dist'],
      },
    }),
  ],
})
