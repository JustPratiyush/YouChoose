# YouChoose 1.1.0

Store name: **YouChoose - A Better YouTube, Remove Distractions**

## What's new

- YouTube's native Ask/Gemini button now remains available alongside YouChoose's separate **Summarize this video** button.
- New **Use video frame thumbnails** switch in the popup and settings: show YouTube's middle video still (50%, approximate) instead of creator artwork. Off by default; turning it off restores the original thumbnails. If a video has no available still, its original thumbnail stays visible.
- Expanded extension name to explain what YouChoose does.

Existing settings are preserved. No new permissions or host access are requested.

## Upload

Run `sh store/package.sh` to build `store/youchoose-1.1.0.zip`. Upload that package as an update to the existing YouChoose item in the Chrome Web Store Developer Dashboard. The version has increased from 1.0.0 to 1.1.0.

The archive contains only runtime files and license notices. The new name is supplied by `manifest.json`. This local package has not been submitted to the store.
