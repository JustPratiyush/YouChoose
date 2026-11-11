# YouChoose privacy policy

_Last updated: November 8, 2026_

YouChoose is a browser extension that changes how YouTube looks and works for you. It has no account, no server of its own, no analytics and no ads. The developer never receives any of your data.

## What stays on your device

YouChoose saves the following in your browser's local extension storage (`chrome.storage.local`). It never leaves your computer and isn't synced:

- Your settings: which features are on or off.
- Your blocklist: the channels, words and videos you chose to hide.
- Your summary history: the title, channel, length and ID of the last 50 videos you summarized, plus when you did it and whether you used ChatGPT or Claude. You can remove items or clear it on the settings page.

Uninstalling YouChoose deletes all of this.

## What is sent, and to whom

YouChoose only sends data where a feature needs it:

| When | What is sent | Sent to | Why |
| --- | --- | --- | --- |
| You open a video or Short while "Show dislike count" is on | The video's ID, nothing else | returnyoutubedislikeapi.com, a public service that estimates dislike counts | To show the dislike count and the like/dislike bar. Turn "Show dislike count" off and nothing is sent. |
| You browse YouTube while "Use video frame thumbnails" is on | Thumbnail requests containing the displayed videos' IDs, plus standard browser request information | YouTube's image CDN (i.ytimg.com) | To display an automatic video still instead of creator artwork. This feature is off by default. |
| You click "Summarize this video" | The video's ID | YouTube (www.youtube.com) | To download the video's captions. |
| You click "Summarize this video" | The transcript, title, channel and the prompt you can edit in settings | ChatGPT (chatgpt.com) or Claude (claude.ai), whichever you picked, in a new tab in your own account | To ask it for a summary. It's typed into the message box and only sent when you press Enter, unless you turn on "Send the message automatically" in settings. |

Your likes, dislikes, watch history, blocklist and settings are never sent anywhere. What ChatGPT and Claude do with a message you send them is covered by their own privacy policies.

## What YouChoose does not do

- It doesn't sell your data or share it with anyone else.
- It doesn't use your data for advertising, profiling or credit decisions.
- It doesn't run code downloaded from the internet. Everything it runs is inside the extension.

The use of information received by YouChoose adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), including the Limited Use requirements.

## Changes and contact

If this policy changes, the new version will be posted here with a new date. Questions? [Open an issue on GitHub](https://github.com/JustPratiyush/YouChoose/issues).
