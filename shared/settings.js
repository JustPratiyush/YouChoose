// Settings shared by the popup, options page, background worker and content scripts.
// Everything lives in chrome.storage.local as flat keys; missing keys fall back to these defaults.

// {{placeholders}} are filled in for each video; see the options page for the list.
const YC_SUMMARY_PROMPT = `Please summarize the YouTube video "{{title}}" by {{channel}} ({{duration}}): {{url}}

Its complete transcript is {{where}}. Read the ENTIRE transcript from beginning to end before you write anything. Don't skim and don't stop partway: the second half matters as much as the first.

Then write a detailed, comprehensive summary that lets someone who never watches the video understand everything valuable in it. Use this structure:

## TL;DR
3–5 sentences on what the video is about and its central message.

## Detailed breakdown
Follow the video's own structure, in order. For each major section, give a heading with its timestamp range, then explain the points, arguments, explanations, examples and stories in depth. Don't compress several ideas into one vague sentence.

## Key learnings and insights
Every important lesson, idea and takeaway, each explained in a sentence or two.

## Facts, figures and references
Statistics, numbers, names, studies, tools, books, products and resources mentioned, with their context.

## Actionable advice
Concrete steps, frameworks, techniques or recommendations a viewer can apply.

## Notable quotes
The most memorable lines, quoted exactly, with timestamps.

## Open questions and caveats
Claims made without evidence, points the speaker was unsure about, and anything left unresolved.

Cite timestamps like [12:34] so I can jump to the source. The captions may be auto-generated, so silently fix obvious speech-recognition errors in names and terms. Skip a section only if it genuinely doesn't apply. Write the summary in English.`;

const YC_DEFAULTS = {
  enabled: true,

  // Shorts
  hideShorts: true,
  redirectShorts: true,

  // Focus
  hideRelated: false,
  hideComments: false,

  // Dislikes
  showDislikes: true,
  showRatioBar: true,

  // Summarize ("Summarize this video" button under each video)
  summarizeWith: 'chatgpt', // 'chatgpt' | 'claude'
  summaryDelivery: 'file', // 'file' attaches a .txt; 'inline' pastes the transcript into the message
  summaryTimestamps: true,
  summaryDescription: true,
  summaryLang: 'en',
  summaryAutoSend: false,
  summaryPrompt: YC_SUMMARY_PROMPT,

  // Blocklist (the four lists can be paused without losing them)
  useBlocklist: true,
  blockedChannels: '',
  blockedTitles: '',
  blockedVideos: '',
  blockedComments: '',

  // Blocking
  hideMixes: false,
  hideMovies: false,
  hideExplore: false,
  hideMoreFromYouTube: false,
  hideReportHistory: false,
  hideGuideFooter: false,

  // Video filters (minutes; 0 = off)
  minDuration: 0,
  maxDuration: 0,
  hideWatched: false,
  watchedPercent: 90,
};

function loadSettings() {
  return chrome.storage.local.get(YC_DEFAULTS);
}

function saveSettings(changes) {
  return chrome.storage.local.set(changes);
}

function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.keys(changes).some((key) => key in YC_DEFAULTS)) {
      loadSettings().then(callback);
    }
  });
}
