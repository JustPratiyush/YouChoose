const fields = [...document.querySelectorAll('[data-key]')];
const status = document.getElementById('status');
const saveTimers = new Map();

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function fill(settings) {
  document.getElementById('blocklist').classList.toggle('off', !settings.useBlocklist);
  for (const field of fields) {
    const value = settings[field.dataset.key];
    if (field.type === 'checkbox') field.checked = value;
    else if (field.type === 'radio') field.checked = field.value === value;
    else if (field !== document.activeElement) field.value = field.type === 'number' && !value ? '' : value;
  }
}

function readField(field) {
  const key = field.dataset.key;
  if (field.type === 'checkbox') return field.checked;
  if (key === 'summaryLang') return field.value.trim().toLowerCase() || YC_DEFAULTS.summaryLang;
  if (key === 'summaryPrompt') return field.value.trim() ? field.value : YC_DEFAULTS.summaryPrompt;
  if (field.type !== 'number') return field.value;
  const number = Math.max(0, Math.round(Number(field.value) || 0));
  return key === 'watchedPercent' ? Math.min(100, number || YC_DEFAULTS.watchedPercent) : number;
}

function saveField(field) {
  clearTimeout(saveTimers.get(field));
  saveSettings({ [field.dataset.key]: readField(field) }).then(() => showStatus('All changes saved'));
}

for (const field of fields) {
  // Text boxes save shortly after typing stops; everything else saves on change.
  field.addEventListener('input', () => {
    if (field.tagName !== 'TEXTAREA') return;
    showStatus('Saving…');
    clearTimeout(saveTimers.get(field));
    saveTimers.set(field, setTimeout(() => saveField(field), 400));
  });
  field.addEventListener('change', () => saveField(field));
}

document.getElementById('reset-prompt').addEventListener('click', () => {
  saveSettings({ summaryPrompt: YC_DEFAULTS.summaryPrompt }).then(() => showStatus('Prompt reset to default'));
});

document.getElementById('export').addEventListener('click', async () => {
  const settings = await loadSettings();
  const file = new Blob([JSON.stringify({ app: 'YouChoose', ...settings }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = `youchoose-settings-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showStatus('Settings exported');
});

const importFile = document.getElementById('import-file');
document.getElementById('import').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const [file] = importFile.files;
  importFile.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const changes = Object.fromEntries(
      Object.entries(YC_DEFAULTS)
        .filter(([key, fallback]) => typeof data[key] === typeof fallback)
        .map(([key]) => [key, data[key]]),
    );
    if (!Object.keys(changes).length) throw new Error('no YouChoose settings in this file');
    await saveSettings(changes);
    showStatus(`Imported ${Object.keys(changes).length} settings`);
  } catch (error) {
    showStatus(`Import failed: ${error.message}`, true);
  }
});

// --- Tabs: one section at a time, chosen from the bar at the top (#blocklist, #history, …) ---

const tabs = [...document.querySelectorAll('.tabs a')];
const panels = [...document.querySelectorAll('.panel')];

function showTab(id) {
  const panel = panels.find((p) => p.id === id) || panels[0];
  for (const p of panels) p.hidden = p !== panel;
  for (const tab of tabs) tab.setAttribute('aria-current', tab.hash === `#${panel.id}` ? 'page' : 'false');
  window.scrollTo(0, 0);
}

for (const tab of tabs) {
  tab.addEventListener('click', (event) => {
    event.preventDefault(); // no jump to the section; showTab (via hashchange) handles it
    if (location.hash !== tab.hash) location.hash = tab.hash;
  });
}
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
showTab(location.hash.slice(1));

// --- Summary history (written by the background worker after each summary) ---

const historyList = document.getElementById('history-list');

function formatLength(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function historyItem(entry) {
  const url = `https://www.youtube.com/watch?v=${entry.videoId}`;
  const item = document.createElement('li');
  item.className = 'history-item';

  const thumb = Object.assign(document.createElement('a'), { className: 'thumb', href: url, target: '_blank' });
  thumb.append(Object.assign(document.createElement('img'), {
    src: `https://i.ytimg.com/vi/${entry.videoId}/mqdefault.jpg`,
    alt: '',
    loading: 'lazy',
  }));
  const length = formatLength(entry.durationSec);
  if (length) thumb.append(Object.assign(document.createElement('span'), { className: 'length', textContent: length }));

  const meta = document.createElement('div');
  meta.className = 'meta';
  const when = new Date(entry.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  meta.append(
    Object.assign(document.createElement('a'), { className: 'title', href: url, target: '_blank', textContent: entry.title }),
    Object.assign(document.createElement('span'), { className: 'sub', textContent: entry.channel }),
    Object.assign(document.createElement('span'), { className: 'sub', textContent: `Summarized in ${entry.site} · ${when}` }),
  );

  const again = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: 'Summarize again' });
  again.addEventListener('click', async () => {
    again.disabled = true;
    again.textContent = 'Getting transcript…';
    try {
      const response = await chrome.runtime.sendMessage({ type: 'yc-summarize', videoId: entry.videoId });
      if (!response?.ok) throw new Error(response?.error || "Couldn't summarize this video.");
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      again.disabled = false;
      again.textContent = 'Summarize again';
    }
  });
  const remove = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'remove',
    textContent: '×',
    title: 'Remove from history',
  });
  remove.setAttribute('aria-label', `Remove "${entry.title}" from history`);
  remove.addEventListener('click', async () => {
    const { summaryHistory } = await chrome.storage.local.get({ summaryHistory: [] });
    await chrome.storage.local.set({ summaryHistory: summaryHistory.filter((e) => e.videoId !== entry.videoId) });
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(again, remove);
  item.append(thumb, meta, actions);
  return item;
}

function renderHistory(summaryHistory) {
  historyList.replaceChildren(...summaryHistory.map(historyItem));
  document.getElementById('history-empty').hidden = summaryHistory.length > 0;
  document.getElementById('clear-history').hidden = summaryHistory.length === 0;
}

document.getElementById('clear-history').addEventListener('click', async () => {
  if (confirm('Clear your summary history?')) await chrome.storage.local.set({ summaryHistory: [] });
});

chrome.storage.local.get({ summaryHistory: [] }).then(({ summaryHistory }) => renderHistory(summaryHistory));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.summaryHistory) renderHistory(changes.summaryHistory.newValue || []);
});

loadSettings().then(fill);
onSettingsChanged(fill);
