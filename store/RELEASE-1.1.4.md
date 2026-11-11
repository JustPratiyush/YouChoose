# YouChoose 1.1.4

- Fixed **Block this channel** and **Block this video** being unreadable in dark theme on search results, the watch page and comments. YouTube renamed its text-colour variable, so the two items fell back to black on the dark menu. They now use YouTube's current variable, with the old one as a fallback.
- New icon: the artwork fills the whole tile and has a black outer border, so it stays visible on light toolbars and pages. All four extension icon sizes, `icons/logo.png` and the store icon are redrawn.
- Store screenshots 2, 3 and 4, and the matching README images, are now real captures of YouTube with the extension running.

## Validation

`node tests/browser-regressions.cjs` passes all six checks against 1.1.4 (thumbnails, independent Gemini and summary buttons, recycled cards, popup/options sync, no uncaught errors).

The menu fix was checked on live youtube.com in Chromium with the unpacked extension, dark theme: both items render in YouTube's primary text colour. The new icons were checked at 16, 32, 48 and 128 px. The extension was not loaded in Chrome's toolbar by hand for this release.

## Package

Run `sh store/package.sh` to build `store/youchoose-1.1.4.zip`. Upload this archive to the existing Chrome Web Store item. Settings and permissions are preserved. The package has not been submitted to the store.
