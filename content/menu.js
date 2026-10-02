// Adds "Block this channel" and "Block this video" to the top of YouTube's own ⋮ menus on videos,
// comments and the watch page. Clicking one adds the item to the blocklist (see blockItem in blocklist.js).

const MENU_TRIGGER = '[class*="MenuButton"], ytd-menu-renderer';
const NOT_A_MENU_TRIGGER = '#top-level-buttons-computed, #flexible-item-buttons, .yc-summarize'; // like, share, save…
const BLOCK_ICON_PATH =
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z';

let menuSource = null; // the ⋮ button that opened the current menu

document.addEventListener(
  'click',
  (event) => {
    if (event.target.closest?.('ytd-popup-container')) return; // a click inside the menu itself
    const trigger = event.target.closest?.(MENU_TRIGGER);
    menuSource = trigger && !event.target.closest(NOT_A_MENU_TRIGGER) ? trigger : null;
  },
  true,
);

// What the open menu is about: a video card, a comment, or the video being watched.
function menuTargetInfo() {
  if (!menuSource?.isConnected) return null;
  const card = menuSource.closest(CARD_SELECTOR);
  if (card) {
    const info = readCard(card);
    return info.isPlaylist ? { ...info, videoId: null } : info;
  }
  const comment = menuSource.closest(COMMENT_SELECTOR);
  if (comment) return { channel: readCommentAuthor(comment) };
  if (menuSource.closest('ytd-watch-metadata')) return readWatchPage();
  return null;
}

function openMenuList() {
  for (const dropdown of document.querySelectorAll('ytd-popup-container tp-yt-iron-dropdown')) {
    if (getComputedStyle(dropdown).display === 'none') continue;
    const list = dropdown.querySelector('yt-list-view-model[role="menu"], ytd-menu-popup-renderer tp-yt-paper-listbox');
    if (list) return list;
  }
  return null;
}

function blockIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'yc-menu-icon');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', BLOCK_ICON_PATH);
  svg.append(path);
  return svg;
}

function menuItem(list, what) {
  const label = what === 'video' ? 'Block this video' : 'Block this channel';
  // Newer menus are plain markup we can copy, so the item looks exactly like YouTube's own.
  const template = list.querySelector('yt-list-item-view-model');
  const copy = template?.firstElementChild?.cloneNode(true);
  const copyText = copy?.querySelector('[role="text"]');
  let item;
  if (copy && copyText) {
    item = document.createElement('div');
    item.className = template.className;
    copyText.textContent = label;
    copy.querySelector('svg')?.replaceWith(blockIcon());
    item.append(copy);
  } else {
    item = document.createElement('div');
    item.className = 'yc-menu-item';
    item.setAttribute('role', 'menuitem');
    item.tabIndex = 0;
    const text = document.createElement('span');
    text.textContent = label;
    item.append(blockIcon(), text);
  }

  // Keep YouTube's menu from treating our item as one of its own.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
    item.addEventListener(type, (event) => event.stopPropagation());
  }
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const info = menuTargetInfo();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    blockItem(what, info);
  });
  item.addEventListener('keydown', (event) => event.key === 'Enter' && item.click());
  return item;
}

function scanMenu() {
  if (!YC.isTopFrame) return;
  const list = openMenuList();
  if (!list) return;
  const info = YC.on && YC.settings.useBlocklist ? menuTargetInfo() : null;
  const wanted = [];
  if (info?.channel && (info.channel.ids.length || info.channel.name)) wanted.push('channel');
  if (info?.videoId) wanted.push('video');

  let group = list.parentElement.querySelector(':scope > .yc-menu');
  if (group && group.dataset.items === wanted.join()) return;
  group?.remove();
  if (!wanted.length) return;

  group = document.createElement('div');
  group.className = 'yc-menu';
  group.dataset.items = wanted.join();
  group.append(...wanted.map((what) => menuItem(list, what)));
  list.before(group);
  window.dispatchEvent(new Event('resize')); // makes YouTube re-measure the menu so nothing is cut off
}

YC.features.push({ scan: scanMenu });
