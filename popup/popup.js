const switches = [...document.querySelectorAll('input[data-key]')];

const valueOf = (input) => (input.type === 'radio' ? input.value : input.checked);

function render(settings) {
  for (const input of switches) {
    const value = settings[input.dataset.key];
    input.checked = input.type === 'radio' ? input.value === value : value;
  }
  document.body.classList.toggle('off', !settings.enabled);
  document.getElementById('status').textContent = settings.enabled ? 'Active on YouTube' : 'Paused — YouTube is untouched';

  const blocked = ['blockedChannels', 'blockedTitles', 'blockedVideos', 'blockedComments']
    .reduce((total, key) => total + parseLines(settings[key]).length, 0);
  const entries = `${blocked} ${blocked === 1 ? 'entry' : 'entries'}`;
  document.getElementById('blocklist-count').textContent = !blocked
    ? 'Block channels, words and videos'
    : settings.useBlocklist
      ? `${entries} on your blocklist`
      : `Paused — your ${entries} are kept`;

  // Collapsed groups show how many of their switches are on.
  for (const group of document.querySelectorAll('details.group')) {
    const inputs = [...group.querySelectorAll('input[type="checkbox"]')];
    const on = inputs.filter((input) => input.checked).length;
    group.querySelector('.group-state').textContent = on ? `${on} of ${inputs.length} on` : 'All off';
  }
}

for (const input of switches) {
  input.addEventListener('change', () => saveSettings({ [input.dataset.key]: valueOf(input) }));
}

document.getElementById('more-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// One keyword at a time, added to "Words in video titles" (the settings page takes many at once).
const keywordInput = document.getElementById('keyword');
const keywordStatus = document.getElementById('keyword-status');

document.getElementById('add-keyword').addEventListener('submit', async (event) => {
  event.preventDefault();
  const keyword = keywordInput.value.trim();
  if (!keyword) return keywordInput.focus();

  const { blockedTitles, useBlocklist } = await loadSettings();
  const already = parseLines(blockedTitles).some((line) => line.toLowerCase() === keyword.toLowerCase());
  if (!already) {
    const kept = blockedTitles.trimEnd();
    await saveSettings({ blockedTitles: `${kept ? `${kept}\n` : ''}${keyword}\n` });
  }

  keywordStatus.hidden = false;
  keywordStatus.textContent = already
    ? `“${keyword}” is already on your blocklist.`
    : `Videos with “${keyword}” in the title are now hidden.${useBlocklist ? '' : ' (Your blocklist is paused.)'}`;
  keywordInput.value = '';
  keywordInput.focus();
});

loadSettings().then(render);
onSettingsChanged(render);
