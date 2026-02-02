# CLAUDE.md

## Build

- `npm run build` — builds Chrome and Firefox extensions to `dist/` using esbuild via `build.js`
- `npm run watch` — same as build but watches for changes
- The `@esbuild/darwin-arm64` package must be installed for builds to work on Apple Silicon

## Project Structure

- `src/` — TypeScript source files
- `chrome/` — Chrome-specific manifest
- `firefox/` — Firefox-specific manifest (if present)
- `public/` — Static assets copied to dist (e.g. `sidepanel.html`)
- `dist/chrome/` and `dist/firefox/` — build output

## Testing

- `npm test` — runs Jest via `npx jest`

## Linting / Formatting

- `npm run lint` — ESLint with autofix
- `npm run style` — Prettier formatting
