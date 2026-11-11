# Chrome Web Store update: YouChoose 1.1.3

## Upload file

**`youchoose-1.1.3.zip`** in this folder is the complete upload package. Upload the ZIP directly without unzipping it.

It contains the runtime extension and license notices only. The manifest is at the archive root. Development tests, screenshots, release notes, Git files and local settings are excluded.

## Update your existing listing

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and select your existing **YouChoose** item (`cfcegcgfmmgihngficddaoglpfopjnka`).
2. Under **Package**, choose **Upload new package** and select `youchoose-1.1.3.zip`.
3. Confirm that the uploaded version is **1.1.3**. The new extension name and short description are supplied by the manifest below.
4. Update the store description with the copy in `STORE-LISTING-1.1.3.txt`, if desired. Update your existing hosted privacy policy from the current `PRIVACY.md` in the repository, which includes the optional thumbnail requests to YouTube's image CDN. Check that the listing's privacy information reflects that policy.
5. Save the listing changes and choose **Submit for Review**. Select your preferred publishing timing in the submission dialog.

Upload this package to the existing item to distribute the update to its users. These steps follow [Chrome's official extension-update instructions](https://developer.chrome.com/docs/webstore/update).

## Manifest metadata

Name: **YouChoose - A Better YouTube, Remove Distractions**

Short description:

> Hide Shorts and distractions, block channels and keywords, use video frame thumbnails, see dislikes, and summarize with AI.

Version: **1.1.3**

## Suggested update announcement

New: optionally replace creator artwork with YouTube's middle video frame (approximately 50%). Enable “Use video frame thumbnails” in the popup or settings.

YouChoose's “Summarize this video” button now appears on the same row as the native video controls, while YouTube's Ask/Gemini button remains separate where available. This update also fixes frozen video links, missing summary buttons and cropped action buttons.

Existing settings are preserved, and no new permissions are requested.

## Package verification

- Archive integrity and all packaged JavaScript syntax checked.
- Manifest references and PNG icon sizes verified.
- Version is higher than the original 1.0.0 package.
- Permissions and host permissions match the original 1.0.0 package.
- Packaged scripts match the current source.
- Button, thumbnail and settings regression checks passed; action-button visibility was also checked on the live YouTube page in Brave.

The machine-readable verification record is `package-validation-1.1.3.json`. The ZIP is ready for upload; it has not been submitted or published.
