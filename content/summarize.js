// "Summarize this video": an independent button inside YouTube's action group.
// Never clone or replace the native Ask/Gemini button. The worker fetches the
// transcript and opens a new ChatGPT/Claude chat with it.

const SUMMARIZE_LABEL = 'Summarize this video';
const CHAT_NAMES = { chatgpt: 'ChatGPT', claude: 'Claude' };

function buildSummarizeButton() {
  const wrapper = document.createElement('div');
  wrapper.className = 'yc-summary-action';
  const target = document.createElement('button');
  target.type = 'button';
  const label = document.createElement('span');
  label.textContent = SUMMARIZE_LABEL;
  target.append(logoImage(), label);
  wrapper.append(target);
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
  const metadata = document.querySelector('ytd-watch-metadata');
  const host = metadata?.querySelector('ytd-menu-renderer #top-level-buttons-computed');
  let wrapper = document.querySelector('.yc-summary-action');
  if (!show || !host) {
    wrapper?.remove();
    return;
  }
  // A sibling of the menu falls outside YouTube's measured width and can be
  // clipped by #actions-inner. Join the existing flex group instead, without
  // changing the menu's width, overflow, height or any native button.
  if (wrapper?.parentElement !== host) {
    wrapper ??= buildSummarizeButton();
    host.prepend(wrapper);
  }
  const button = wrapper.querySelector('button');
  const title = `Summarize in ${CHAT_NAMES[YC.settings.summarizeWith] || 'ChatGPT'} with YouChoose`;
  if (button.title !== title) {
    button.title = title;
    button.setAttribute('aria-label', title);
  }
}

YC.features.push({ scan: scanSummarize });
