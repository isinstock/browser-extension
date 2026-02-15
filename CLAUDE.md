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

## Custom Tracking / Element Picker

The element picker lets users select CSS elements on any page to track changes. It supports two activation flows and a Chrome Side Panel integration.

### Activation Flows

- **Flow A (context menu):** User right-clicks → "Track changes on this page" → picker activates on the current tab. On completion, selectors are POSTed to `/api/custom-tracking` and a subscription URL is opened.
- **Flow B (bridge from isinstock.com):** The `isinstock_bridge.ts` content script sends a `StartElementPicker` message from the isinstock.com custom tracking page. Background opens a new tab for the target URL, injects the picker, and forwards results back to the bridge tab.

### Chrome Side Panel

In Chrome, the picker management UI (selector list, extract controls, Done/Cancel) renders in the Side Panel (`sidepanel.tsx`) instead of the in-page bottom bar. Firefox falls back to the in-page panel.

Communication flow:
```
Content Script (element_picker.ts)  →  Background (background.ts)  →  Side Panel (sidepanel.tsx)
       ElementPickerStateSync (rich selection data, received by side panel automatically)
Side Panel  →  Background  →  Content Script
       ElementPickerCommand (remove, change-extract, change-attribute, done, cancel)
```

- The content script is the **source of truth** for selection state. The side panel is a remote view.
- `ElementPickerStateSync` messages are sent by the content script via `browser.runtime.sendMessage` and received by both the background and side panel (extension pages automatically receive runtime messages).
- `ElementPickerCommand` messages flow from the side panel → background → content script (via `tabs.sendMessage`).
- When the side panel loads, it sends `ElementPickerSidePanelReady` to the background, which either starts a new picker session or tells an existing one to resync.
- `useSidePanel` flag on `StartElementPickerMessage` tells the content script whether to suppress the in-page panel.

### Key Files

- `src/@types/messages.ts` — All message types including `ElementPickerStateSync`, `ElementPickerCommand`, `PickerSelectionInfo`
- `src/content_scripts/element_picker.ts` — Picker logic: overlays, selection state, CSS selector computation, extract preview. Sends `ElementPickerUpdate`/`Complete`/`Cancel` and `ElementPickerStateSync`.
- `src/content_scripts/element_picker.css` — Styles for the in-page panel (Firefox fallback)
- `src/background.ts` — Manages picker sessions (`pickerSessions` map), relays messages between content script/bridge/side panel, opens/closes side panel
- `src/sidepanel.tsx` — Preact app rendering the selector list, extract controls, and toolbar. Chrome-only.
- `public/sidepanel.html` — Side panel HTML with inline dark-themed CSS
- `src/content_scripts/isinstock_bridge.ts` — Bridge for Flow B, runs on isinstock.com pages

### Data Format

The picker sends `SelectorEntry[]` on completion:
```typescript
{ label: string, cssSelector: string, extract: 'text_content' | 'attribute', attributeName: string, preview: string }
```

These map directly to `ContentSelector` records on the Rails side (`css_selector`, `extract`, `attribute_name`, `label`).
