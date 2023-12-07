## Setup

- Open project in Dev Container

### Using production

To hit `https://isinstock.com` while in development, run:

```sh
npm run watch -- --production
```

## Development

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

## Releasing

- Create a production build by running `npm run build -- --production`
- Bump the package version in `package.json` on the `master` branch.
- Run `npm install` to update the `package-lock.json` file.

### Google Chrome

- Generate a ZIP file of the `dist/chrome` directory.
- Upload a new package in Is In Stock's [Package tab](https://chrome.google.com/u/1/webstore/devconsole/355361c6-bf2d-48aa-a191-99790c9dc228/bnglflgcpflggbpbcbpgeaknekceeojd/edit/package).

### Firefox

- Outside of the Codespace, run `web-ext build -s ./dist/firefox` to automatically build the extension.
- [Submit a new version](https://addons.mozilla.org/en-US/developers/addon/is-in-stock/versions/submit/) on the [Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/addon/is-in-stock).
- For "Notes to Reviewer:" provide the following:

```
- Run `npm install`
- Run `npm run build -- --production`
- Run `web-ext build -s ./dist/firefox`
- Visit https://isinstock.com/store/products/available
- You should see the Is In Stock button below Add to Cart button
```

## Structured Data Support

- ✅ JSON-LD
- ✅ RDFa
- ✅ Microdata

## Testing

### Google Chrome

- Run `bin/launch-test-chrome` to run the test suite in Google Chrome.
- Open the profile which has the installed extension.
  - If you do not have the extension installed:
    - run `npm run build -- --production` to build the extension
    - Load it into Google Chrome by visiting `chrome://extensions`
- You should see output similar to `DevTools listening on ws://127.0.0.1:21222/devtools/browser/e3c7f5e3-c1e5-4b81-bda1-4633c5c5f7f7`, copy the UUID portion of the URL which would be `e3c7f5e3-c1e5-4b81-bda1-4633c5c5f7f7` in this example.
- Run `bin/integration-test "e3c7f5e3-c1e5-4b81-bda1-4633c5c5f7f7"`
