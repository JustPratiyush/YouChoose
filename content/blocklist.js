// Blocklist: hides video cards, comments and live-chat messages that match the user's lists,
// guards blocked watch/channel pages, and answers the right-click "Block this…" menu.

const CARD_SELECTOR = [
  'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model',
  'ytd-rich-grid-media',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-playlist-panel-video-renderer',
  'ytd-reel-item-renderer',
  'ytd-channel-renderer',
  'ytd-playlist-renderer',
  'ytd-compact-playlist-renderer',
  'ytd-grid-playlist-renderer',
].join(',');
const CHANNEL_LINK = 'a[href^="/@"], a[href^="/channel/"]';
const COMMENT_SELECTOR = 'ytd-comment-view-model, ytd-comment-renderer';
const PAGE_TITLE = 'yt-page-header-renderer h1, #page-header h1';

let checkedCards = new WeakMap(); // card → { key, target } from its last check
let pageReady = true; // false while YouTube swaps in a new page, so we don't read stale metadata
let playerBlocked = false;
let rightClicked = null;

function setHidden(element, hidden) {
  if (element.hasAttribute('yc-hidden') !== hidden) element.toggleAttribute('yc-hidden', hidden);
}

function readChannel(links, fallbackNameElement) {
  const named = links.find((link) => link.textContent.trim());
  return {
    name: textOf(named || fallbackNameElement),
    ids: links.map((link) => channelKey(link.getAttribute('href'))).filter(Boolean),
  };
}

function readDuration(card) {
  for (const badge of card.querySelectorAll('badge-shape, ytd-thumbnail-overlay-time-status-renderer')) {
    const time = badge.textContent.match(/(?:(\d+):)?(\d+):(\d\d)/);
    if (time) return Number(time[1] || 0) * 3600 + Number(time[2]) * 60 + Number(time[3]);
  }
  return null; // live streams, Shorts, playlists
}

function readWatchedPercent(card) {
  const bar = card.querySelector(
    'ytd-thumbnail-overlay-resume-playback-renderer #progress, [class*="WatchedProgressBarSegment"], [class*="watched-progress-bar-segment"]',
  );
  return (bar && parseFloat(bar.style.width)) || 0;
}

function readCard(card) {
  const videoLink = card.querySelector('a[href*="/watch?v="], a[href^="/shorts/"]');
  const titleElement = card.querySelector('#video-title') || card.querySelector('h3');
  const contentId = card.querySelector('[class*="content-id-"]')?.className.match(/content-id-([\w-]+)/);
  return {
    videoId: videoLink && videoIdFrom(videoLink.getAttribute('href')),
    title: (titleElement && titleElement.getAttribute('title')) || textOf(titleElement),
    channel: readChannel(
      [...card.querySelectorAll(CHANNEL_LINK)],
      card.querySelector('ytd-channel-name #text, yt-content-metadata-view-model > div:first-child > span:first-child'),
    ),
    duration: readDuration(card),
    watched: readWatchedPercent(card),
    // Video IDs are 11 characters; playlists have longer IDs, and Mixes start with "RD".
    isPlaylist: (contentId && contentId[1].length > 11) || /playlist|radio/i.test(card.tagName),
    isMix: Boolean(contentId && /^RD[\w-]{11,}$/.test(contentId[1])),
  };
}

function cardIsBlocked(card, info) {
  const { settings, blocklist } = YC;
  if (info.videoId && blocklist.videos.has(info.videoId)) return true;
  if (matchesChannel(blocklist.channels, info.channel) || matchesAny(blocklist.titles, info.title)) return true;
  if (settings.hideMixes && info.isMix) return true;

  // Length and watched filters are for recommendations, not for playlists or your history.
  const exempt =
    card.matches('ytd-playlist-panel-video-renderer, ytd-playlist-video-renderer') ||
    /^\/(feed\/history|playlist)/.test(location.pathname);
  if (exempt) return false;
  if (info.duration !== null) {
    if (settings.minDuration > 0 && info.duration < settings.minDuration * 60) return true;
    if (settings.maxDuration > 0 && info.duration > settings.maxDuration * 60) return true;
  }
  return settings.hideWatched && info.watched > 0 && info.watched >= settings.watchedPercent;
}

function hasCardFilters() {
  const { settings: s, blocklist: b } = YC;
  return Boolean(
    b.videos.size || b.channels.ids.size || b.channels.names.length || b.titles.length ||
      s.minDuration || s.maxDuration || s.hideWatched || s.hideMixes,
  );
}

function scanCards() {
  for (const card of document.querySelectorAll(CARD_SELECTOR)) {
    const link = card.querySelector('a[href]');
    if (!link) continue; // not rendered yet
    // YouTube reuses card elements for new videos, so re-check whenever the link or title changes.
    const key = `${link.getAttribute('href')}|${textOf(card.querySelector('#video-title, h3'))}`;
    const previous = checkedCards.get(card);
    if (previous && previous.key === key) continue;
    // Grid items wrap the card; hide the wrapper so the grid reflows.
    const target = previous?.target || card.closest('ytd-rich-item-renderer') || card;
    checkedCards.set(card, { key, target });
    setHidden(target, cardIsBlocked(card, readCard(card)));
  }
}

function readCommentAuthor(comment) {
  const author = comment.querySelector('#author-text');
  return readChannel(author ? [author] : [], null);
}

function scanComments() {
  const { channels, comments } = YC.blocklist;
  for (const comment of document.querySelectorAll(COMMENT_SELECTOR)) {
    const blocked =
      matchesChannel(channels, readCommentAuthor(comment)) ||
      matchesAny(comments, textOf(comment.querySelector('#content-text')));
    // A top-level comment takes its replies with it.
    const target = comment.id === 'comment' ? comment.closest('ytd-comment-thread-renderer') || comment : comment;
    setHidden(target, blocked);
  }
}

function scanLiveChat() {
  const { channels, comments } = YC.blocklist;
  for (const message of document.querySelectorAll('yt-live-chat-text-message-renderer')) {
    const author = { name: textOf(message.querySelector('#author-name')), ids: [] };
    setHidden(message, matchesChannel(channels, author) || matchesAny(comments, textOf(message.querySelector('#message'))));
  }
}

function readWatchPage() {
  const owner = document.querySelector('ytd-watch-metadata #owner');
  return {
    videoId: new URLSearchParams(location.search).get('v'),
    title: textOf(document.querySelector('ytd-watch-metadata #title h1, ytd-watch-metadata h1')),
    channel: readChannel(owner ? [...owner.querySelectorAll(CHANNEL_LINK)] : [], null),
  };
}

function guardWatchPage() {
  let blocked = false;
  if (location.pathname === '/watch') {
    const { videos, channels, titles } = YC.blocklist;
    const info = readWatchPage();
    blocked =
      videos.has(info.videoId) ||
      (pageReady && (matchesChannel(channels, info.channel) || matchesAny(titles, info.title)));
  }
  setPlayerBlocked(blocked);
}

function setPlayerBlocked(blocked) {
  playerBlocked = blocked;
  const player = document.querySelector('#movie_player');
  let overlay = document.querySelector('.yc-blocked');
  if (!blocked || !player) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'yc-blocked';
    const heading = document.createElement('strong');
    heading.textContent = 'Blocked by YouChoose';
    const detail = document.createElement('span');
    detail.textContent = 'This video or its channel is on your blocklist.';
    overlay.append(heading, detail);
    player.append(overlay);
  }
  const video = player.querySelector('video');
  if (video && !video.paused) video.pause();
}

// Keep a blocked video paused even if YouTube or the user tries to resume it.
document.addEventListener(
  'play',
  (event) => {
    if (playerBlocked && event.target.closest?.('#movie_player')) event.target.pause();
  },
  true,
);

function guardChannelPage() {
  if (!/^\/(@|channel\/|c\/|user\/)/.test(location.pathname)) return;
  const id = channelKey(location.pathname);
  const channel = { name: pageReady ? textOf(document.querySelector(PAGE_TITLE)) : '', ids: id ? [id] : [] };
  if (matchesChannel(YC.blocklist.channels, channel)) location.replace('/');
}

function scanBlocklist() {
  if (!YC.on) return;
  if (location.pathname.startsWith('/live_chat')) return scanLiveChat();
  if (!YC.isTopFrame) return;
  const { channels, comments } = YC.blocklist;
  if (hasCardFilters()) scanCards();
  if (channels.ids.size || channels.names.length || comments.length) scanComments();
  guardWatchPage();
  guardChannelPage();
}

function resetBlocklist() {
  checkedCards = new WeakMap();
  document.querySelectorAll('[yc-hidden]').forEach((element) => element.removeAttribute('yc-hidden'));
  if (!YC.on) setPlayerBlocked(false);
}

// --- Blocking from menus (YouTube's ⋮ menu in menu.js, and the browser's right-click menu) ---

document.addEventListener('contextmenu', (event) => (rightClicked = event.target), true);

function infoAt(element) {
  const card = element?.closest?.(CARD_SELECTOR);
  if (card) return readCard(card);
  const comment = element?.closest?.(COMMENT_SELECTOR);
  if (comment) return { channel: readCommentAuthor(comment) };
  const chat = element?.closest?.('yt-live-chat-text-message-renderer');
  if (chat) return { channel: { name: textOf(chat.querySelector('#author-name')), ids: [] } };
  if (location.pathname === '/watch') return readWatchPage();
  const id = channelKey(location.pathname);
  if (id) return { channel: { name: textOf(document.querySelector(PAGE_TITLE)), ids: [id] } };
  return null;
}

async function appendToList(key, label, entry) {
  const { [key]: current } = await chrome.storage.local.get({ [key]: '' });
  if (parseLines(current).includes(entry)) return;
  const kept = current.trimEnd();
  await saveSettings({ [key]: `${kept ? `${kept}\n` : ''}// ${label}\n${entry}\n` });
}

// what: 'channel' | 'video'; info: from readCard / readWatchPage / a comment author.
async function blockItem(what, info) {
  if (what === 'video') {
    if (!info?.videoId) return showToast('YouChoose: no video found here to block');
    const label = info.title || info.videoId;
    await appendToList('blockedVideos', label, info.videoId);
    showToast(`Blocked video: ${label}`);
  } else {
    const entry = info?.channel?.ids[0] || info?.channel?.name;
    if (!entry) return showToast('YouChoose: no channel found here to block');
    const label = info.channel.name || entry;
    await appendToList('blockedChannels', label, entry);
    showToast(`Blocked channel: ${label}`);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'yc-block') return;
  let info = infoAt(rightClicked);
  if (message.what === 'video' && !info?.videoId && location.pathname === '/watch') info = readWatchPage();
  blockItem(message.what, info);
});

YC.features.push({
  apply: resetBlocklist,
  scan: scanBlocklist,
  navigateStart: () => (pageReady = false),
  navigateFinish: () => (pageReady = true),
});
