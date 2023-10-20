## Setup

- Open project in Dev Container

### Using production

To hit `https://isinstock.com` while in development, run:

```sh
npm run watch -- --production
```

### Google Chrome

- Within the Codespace, run `cmd+shift+b` to build the project in development mode.
- Load extension to Google Chrome by visiting `chrome://extensions`
- Enable Developer mode in the top right of your window
- Click Load unpacked in the top left of your window
- Locate and select the `dist` directory containing the built extension
- After making changes locally, you'll need to reload the extension in the Google Chrome extensions page

### Firefox

- Outside of the Codespace, run `web-ext run -s ./dist/firefox` to automatically load the extension in a development instance of Firefox.
- All future builds will update the extension automatically.

## Structured Data Support

- ✅ JSON-LD
- ✅ RDFa
- ✅ Microdata
