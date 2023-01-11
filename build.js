const build = require("esbuild").build
const copy = require("esbuild-plugin-copy").copy
const postCssPlugin = require("esbuild-style-plugin")

const watch = process.argv[2] === "--watch"

const res = build({
  logLevel: "info",
  entryPoints: [
    './src/elements/isinstock-button/style.css',
    './src/content_scripts/content_script.tsx',
    './src/content_scripts/retailers/best-buy.tsx',
    './src/content_scripts/retailers/target.tsx',
    './src/background.ts',
    './src/popup.ts',
  ],
  outdir: "dist",
  bundle: true,
  sourcemap: "inline",
  watch,
  target: [
    "chrome58"
  ],
  plugins: [
    postCssPlugin({
      postcss: {
        plugins: [
          require("tailwindcss"),
          require("autoprefixer"),
        ],
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
