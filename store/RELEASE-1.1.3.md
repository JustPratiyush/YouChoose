# YouChoose 1.1.3

- Fixed the summary button being outside YouTube's measured menu width and disappearing beyond the right edge. It now joins the existing `#top-level-buttons-computed` group, before the native buttons, on the same row.
- Removed the extension's action-container width, flex and horizontal-overflow overrides. Native buttons and the like/dislike ratio bar are no longer cropped at the bottom.
- Native Ask/Gemini remains a separate, unchanged control wherever YouTube provides it.

## Validation

Loaded 1.1.3 in Brave and checked the user's watch page visually: the full summary label, like/dislike, Share, Save, Download, More and the ratio bar are visible together without cropping.

Updated the browser regression fixture to include the nested, fixed-height `#actions-inner` wrapper. The checks cover actual horizontal and vertical clipping by ancestors, same-row placement, visible desktop bounds, independent Gemini and summary clicks, and the existing thumbnail and settings regressions. All pass.

## Package

Run `sh store/package.sh` to build `store/youchoose-1.1.3.zip`. Upload this archive to the existing Chrome Web Store item. Settings and permissions are preserved. The package has not been submitted to the store.
