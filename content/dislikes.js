// Dislike counts from a public dislike-count API. Read-only: only the video ID is sent.

const DISLIKE_API = 'https://returnyoutubedislikeapi.com/votes?videoId=';
const ICON_ONLY_CLASSES = [
  ['ytSpecButtonShapeNextIconButton', 'ytSpecButtonShapeNextIconLeading'],
  ['yt-spec-button-shape-next--icon-button', 'yt-spec-button-shape-next--icon-leading'],
];
const votes = new Map(); // videoId → { likes, dislikes } | 'loading' | 'failed'

function getVotes(videoId) {
  const known = votes.get(videoId);
  if (known) return typeof known === 'object' ? known : null;
  votes.set(videoId, 'loading');
  fetch(DISLIKE_API + videoId)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then((data) => votes.set(videoId, { likes: data.likes, dislikes: data.dislikes }))
    .catch(() => votes.set(videoId, 'failed'))
    .finally(queueScan);
  return null;
}

function formatCount(count) {
  const lang = document.documentElement.lang || undefined;
  if (formatCount.lang !== lang || !formatCount.format) {
    formatCount.lang = lang;
    formatCount.format = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format;
  }
  return formatCount.format(count);
}

function currentVideoId() {
  if (location.pathname === '/watch') return new URLSearchParams(location.search).get('v');
  return location.pathname.match(/^\/shorts\/([\w-]{11})/)?.[1] || null;
}

// --- Watch page: count inside the dislike button + ratio bar under the buttons ---

function showWatchDislikes(counts) {
  const buttons = document.querySelector(
    'ytd-watch-metadata segmented-like-dislike-button-view-model, ytd-watch-metadata ytd-segmented-like-dislike-button-renderer',
  );
  const dislike = buttons?.querySelector('dislike-button-view-model button, #segmented-dislike-button button');
  if (!dislike) return;
  if (!counts) {
    removeDislikeText(dislike);
    buttons.querySelector('.yc-ratio')?.remove();
    return;
  }

  let text = dislike.querySelector('.yc-dislike-text');
  if (!text) {
    // Copy the like button's text element so the count picks up YouTube's own styling.
    const likeText = buttons.querySelector('like-button-view-model [class*="ButtonTextContent"], like-button-view-model [class*="button-text-content"]');
    text = likeText ? likeText.cloneNode(false) : document.createElement('div');
    text.classList.add('yc-dislike-text');
    const icon = dislike.querySelector('[class*="ButtonShapeNextIcon"], [class*="button-shape-next__icon"]');
    icon ? icon.after(text) : dislike.append(text);
  }
  for (const [iconOnly, withText] of ICON_ONLY_CLASSES) dislike.classList.replace(iconOnly, withText);
  const value = formatCount(counts.dislikes);
  if (text.textContent !== value) text.textContent = value;

  showRatioBar(buttons, counts);
}

function removeDislikeText(dislike) {
  const text = dislike.querySelector('.yc-dislike-text');
  if (!text) return;
  text.remove();
  for (const [iconOnly, withText] of ICON_ONLY_CLASSES) dislike.classList.replace(withText, iconOnly);
}

function showRatioBar(buttons, { likes, dislikes }) {
  let bar = buttons.querySelector('.yc-ratio');
  if (!YC.settings.showRatioBar || likes + dislikes === 0) return bar?.remove();
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'yc-ratio';
    bar.append(document.createElement('div'));
    buttons.append(bar);
  }
  const liked = (likes / (likes + dislikes)) * 100;
  const width = `${liked.toFixed(1)}%`;
  if (bar.firstChild.style.width !== width) bar.firstChild.style.width = width;
  bar.title = `${likes.toLocaleString()} likes · ${dislikes.toLocaleString()} dislikes (${Math.round(liked)}% liked)`;
}

// --- Shorts: fill YouTube's dislike label, or add a small read-only count under the like button ---

function visibleShortsActionBar() {
  return [...document.querySelectorAll('reel-action-bar-view-model')].find((bar) => {
    const box = bar.getBoundingClientRect();
    return box.height > 0 && box.top >= 0 && box.bottom <= innerHeight;
  });
}

function createShortsDislike() {
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute(
    'd',
    'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z',
  );
  icon.append(path);
  const circle = document.createElement('div');
  circle.className = 'yc-shorts-dislike-icon';
  circle.append(icon);
  const element = document.createElement('div');
  element.className = 'yc-shorts-dislike';
  element.title = 'Dislikes';
  element.append(circle, document.createElement('span'));
  return element;
}

function showShortsDislikes(videoId, counts) {
  const bar = visibleShortsActionBar();
  if (!bar) return;
  const nativeLabel = bar.querySelector('dislike-button-view-model [class*="WithLabelLabel"] span, dislike-button-view-model [class*="with-label__label"] span');
  let added = bar.querySelector('.yc-shorts-dislike');
  if (!counts) {
    if (added?.dataset.video !== videoId) added?.remove();
    return;
  }
  const value = formatCount(counts.dislikes);
  if (nativeLabel) {
    nativeLabel.dataset.ycOriginal ??= nativeLabel.textContent;
    if (nativeLabel.textContent !== value) nativeLabel.textContent = value;
    return;
  }
  if (!added) {
    added = createShortsDislike();
    const like = bar.querySelector('like-button-view-model');
    like ? like.after(added) : bar.prepend(added);
  }
  added.dataset.video = videoId;
  const label = added.querySelector('span');
  if (label.textContent !== value) label.textContent = value;
}

function removeAllDislikes() {
  document.querySelectorAll('dislike-button-view-model button, #segmented-dislike-button button').forEach(removeDislikeText);
  document.querySelectorAll('.yc-ratio, .yc-shorts-dislike').forEach((element) => element.remove());
  document.querySelectorAll('[data-yc-original]').forEach((label) => {
    label.textContent = label.dataset.ycOriginal;
    delete label.dataset.ycOriginal;
  });
}

function scanDislikes() {
  if (!YC.isTopFrame || !YC.on || !YC.settings.showDislikes) return;
  const videoId = currentVideoId();
  if (!videoId) return;
  const counts = getVotes(videoId);
  if (location.pathname === '/watch') showWatchDislikes(counts);
  else showShortsDislikes(videoId, counts);
}

YC.features.push({
  apply: () => {
    if (!YC.on || !YC.settings.showDislikes) removeAllDislikes();
  },
  scan: scanDislikes,
  // Drop failed lookups so they are retried on the next page.
  navigateFinish: () => votes.forEach((value, id) => value === 'failed' && votes.delete(id)),
});
