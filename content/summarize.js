// "Summarize this video": a button in the row under the video (after Share, where YouTube's
// own "Ask" button sits; that one is hidden by youchoose.css). The background worker fetches the
// transcript and opens a new ChatGPT/Claude chat with it.

const SUMMARIZE_LABEL = 'Summarize this video';
const CHAT_NAMES = { chatgpt: 'ChatGPT', claude: 'Claude' };

function buildSummarizeButton(row) {
  const wrapper = document.createElement('div');
  wrapper.className = 'yc-summarize';

  // Copy the Share button's markup (plain elements) so ours matches YouTube's own buttons.
  const share = row.querySelector(':scope > #top-level-buttons-computed > yt-button-view-model button');
  const button = share?.querySelector('[class*="ButtonTextContent"]') ? share.cloneNode(true) : null;
  let label;
  if (button) {
    button.removeAttribute('aria-pressed');
    label = button.querySelector('[class*="ButtonTextContent"]');
    // YouTube loads its icons a moment after the button appears, so fill the icon slot ourselves
    // rather than swapping out an icon that may not be there yet.
    const iconSlot = button.querySelector('[class*="ButtonShapeNextIcon"], [class*="button-shape-next__icon"]');
    if (iconSlot) iconSlot.replaceChildren(logoImage());
    else button.prepend(logoImage());
    wrapper.append(button);
  } else {
    const fallback = document.createElement('button');
    fallback.className = 'yc-summarize-fallback';
    label = document.createElement('span');
    fallback.append(logoImage(), label);
    wrapper.append(fallback);
  }
  label.textContent = SUMMARIZE_LABEL;

  const target = wrapper.querySelector('button');
  target.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    summarizeCurrentVideo(target, label);
  });
  return wrapper;
}

function logoImage() {
  const image = document.createElement('img');
  image.className = 'yc-summarize-logo';
  image.src = chrome.runtime.getURL('icons/icon48.png');
  image.alt = '';
  return image;
}

async function summarizeCurrentVideo(button, label) {
  if (button.disabled) return;
  const videoId = new URLSearchParams(location.search).get('v');
  button.disabled = true;
  label.textContent = 'Getting transcript…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'yc-summarize', videoId });
    if (!response?.ok) throw new Error(response?.error || "Couldn't summarize this video.");
  } catch (error) {
    const reloaded = /context invalidated/i.test(error.message);
    showToast(reloaded ? 'YouChoose was updated. Refresh this page to use Summarize.' : error.message);
  } finally {
    button.disabled = false;
    label.textContent = SUMMARIZE_LABEL;
  }
}

function scanSummarize() {
  if (!YC.isTopFrame) return;
  const show = YC.on && location.pathname === '/watch';
  const row = document.querySelector('ytd-watch-metadata ytd-menu-renderer');
  let wrapper = document.querySelector('.yc-summarize');
  if (!show || !row) {
    wrapper?.remove();
    return;
  }
  if (wrapper?.parentElement !== row) {
    wrapper?.remove();
    wrapper = buildSummarizeButton(row);
    const after = row.querySelector(':scope > #top-level-buttons-computed');
    if (after) after.after(wrapper);
    else row.prepend(wrapper);
  }
  const button = wrapper.querySelector('button');
  const title = `Summarize in ${CHAT_NAMES[YC.settings.summarizeWith] || 'ChatGPT'}`;
  if (button.title !== title) {
    button.title = title;
    button.setAttribute('aria-label', title);
  }
}

YC.features.push({ scan: scanSummarize });
