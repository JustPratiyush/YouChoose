// Background worker: the right-click "Block this…" menu, the OFF badge, and the
// "Summarize this video" job (transcript → new ChatGPT/Claude chat).

importScripts('shared/settings.js', 'summarize/transcript.js', 'summarize/format.js');

const MENU_ITEMS = {
  'block-channel': 'Block this channel',
  'block-video': 'Block this video',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, title] of Object.entries(MENU_ITEMS)) {
      chrome.contextMenus.create({
        id,
        title,
        contexts: ['all'],
        documentUrlPatterns: ['https://www.youtube.com/*'],
      });
    }
    loadSettings().then(showState);
  });
});

// The content script in the clicked frame knows what was under the cursor.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const what = info.menuItemId === 'block-video' ? 'video' : 'channel';
  chrome.tabs.sendMessage(tab.id, { type: 'yc-block', what }, { frameId: info.frameId ?? 0 }).catch(() => {});
});

function showState({ enabled, useBlocklist }) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#606060' });
  for (const id of Object.keys(MENU_ITEMS)) {
    chrome.contextMenus.update(id, { visible: enabled && useBlocklist }, () => void chrome.runtime.lastError);
  }
}

loadSettings().then(showState);
onSettingsChanged(showState);

// --- Summarize this video ---

const CHAT_SITES = {
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { name: 'Claude', url: 'https://claude.ai/new' },
};

// Recent summaries, newest first, shown on the settings page. Kept outside the settings so they
// aren't part of backups and don't make every YouTube tab re-apply its settings.
const HISTORY_LIMIT = 50;

async function recordSummary(transcript, siteName) {
  const { summaryHistory } = await chrome.storage.local.get({ summaryHistory: [] });
  const entry = {
    videoId: transcript.videoId,
    title: transcript.title,
    channel: transcript.channel,
    durationSec: transcript.durationSec,
    site: siteName,
    at: Date.now(),
  };
  const others = summaryHistory.filter((item) => item.videoId !== entry.videoId);
  await chrome.storage.local.set({ summaryHistory: [entry, ...others].slice(0, HISTORY_LIMIT) });
}

async function injectChatScript(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['summarize/chat-inject.js'] });
}

async function chatToast(tabId, message, kind) {
  try {
    await injectChatScript(tabId);
    await chrome.tabs.sendMessage(tabId, { type: 'yc-chat-toast', message, kind });
  } catch {
    // The chat tab was closed or isn't ready.
  }
}

// Fetches the transcript first (so problems show up on YouTube, where the user is), then opens a
// new chat next to the video and hands the transcript and prompt to summarize/chat-inject.js.
async function startSummary(videoId, youtubeTab) {
  const settings = await loadSettings();
  const site = CHAT_SITES[settings.summarizeWith] || CHAT_SITES.chatgpt;
  const transcript = await fetchTranscript(videoId, settings.summaryLang);
  const payload = buildChatPayload(transcript, {
    delivery: settings.summaryDelivery,
    timestamps: settings.summaryTimestamps,
    includeDescription: settings.summaryDescription,
    promptTemplate: settings.summaryPrompt,
  });

  const chatTab = await chrome.tabs.create({
    url: site.url,
    active: true,
    index: youtubeTab ? youtubeTab.index + 1 : undefined,
    openerTabId: youtubeTab?.id,
  });
  recordSummary(transcript, site.name).catch((error) => console.warn('[YouChoose]', error));
  const insertion = (async () => {
    await waitForTabComplete(chatTab.id, 45_000);
    await injectChatScript(chatTab.id);
    const result = await chrome.tabs.sendMessage(chatTab.id, {
      type: 'yc-chat-insert',
      payload: { ...payload, title: transcript.title, autoSend: settings.summaryAutoSend },
    });
    if (!result?.ok) throw new Error(result?.error || `Couldn't add the transcript to ${site.name}.`);
  })();
  insertion.catch((error) => {
    console.warn('[YouChoose]', error);
    chatToast(chatTab.id, error.message, 'error');
  });
  return { site: site.name };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'yc-summarize') return false;
  if (!/^[\w-]{11}$/.test(message.videoId || '')) {
    sendResponse({ ok: false, error: "Couldn't tell which video this is." });
    return false;
  }
  startSummary(message.videoId, sender.tab).then(
    (result) => sendResponse({ ok: true, ...result }),
    (error) => sendResponse({ ok: false, error: error.message }),
  );
  return true; // responds asynchronously
});
