# YouChoose 1.1.1

## Fixes

- Fixed thumbnail replacement fighting YouTube or another thumbnail extension over image sources, which could freeze the page and prevent video clicks. Replacement now changes only the displayed bitmap through CSS, keeping the original image sources, links and event handlers intact.
- YouChoose's summary button now occupies an independent row below the native controls. It does not clone native buttons or consume space in the row containing Ask/Gemini.

Existing settings and permissions are preserved.

## Validation

- Loaded the unpacked update in Brave. Recovered a tab frozen by 1.1.0, verified video frame thumbnails in the home feed, clicked a thumbnail to open its video, and confirmed that native Ask/Gemini and YouChoose's separate summary button were both visible.
- Added `tests/browser-regressions.cjs`, a plain Node/Playwright script covering a competing source-restoration observer, actual thumbnail clicks, resolution and placeholder fallbacks, native button coexistence at two widths, recycled cards, lazy loading, settings synchronization, master/feature toggles and late image responses after disabling.
- The source-restoration regression assertion fails against the prior 1.1.0 upload package and passes against 1.1.1.

Run the checks with `node tests/browser-regressions.cjs` when `playwright-core` and Chromium are installed. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` can point to existing installations.

## Upload and local testing

Build with `sh store/package.sh` and upload `store/youchoose-1.1.1.zip` to the existing Chrome Web Store item. This package has not been submitted to the store.

For unpacked testing, disable the older Web Store copy of YouChoose and reload the unpacked copy, then reload YouTube. Existing tabs retain old scripts until reloaded. If an old tab is unresponsive, exit or close that tab and open YouTube again. The standalone 1plus3 demo can be disabled to test YouChoose's thumbnail setting by itself.
