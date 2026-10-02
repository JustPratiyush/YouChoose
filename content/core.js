// YouChoose content-script core.
// Loads settings, flips the CSS switches on <html>, and re-runs every feature's scan
// (batched to one per animation frame, so changes land before the next paint) whenever
// YouTube changes the page. Features register themselves in YC.features from the other files.

const YC = {
  settings: null,
  blocklist: null,
  features: [], // { apply(), scan(), navigateStart(), navigateFinish() } — all optional
  isTopFrame: window.top === window,
  get on() {
    return Boolean(this.settings && this.settings.enabled);
  },
};

// Settings that are pure CSS (see youchoose.css) become attributes on <html>.
const CSS_SWITCHES = {
  enabled: 'yc-on', // e.g. hides YouTube's "Ask" button, replaced by "Summarize this video"
  hideShorts: 'yc-hide-shorts',
  hideRelated: 'yc-hide-related',
  hideComments: 'yc-hide-comments',
  hideMixes: 'yc-hide-mixes',
  hideMovies: 'yc-hide-movies',
  hideExplore: 'yc-hide-explore',
  hideMoreFromYouTube: 'yc-hide-more-from-youtube',
  hideReportHistory: 'yc-hide-report-history',
  hideGuideFooter: 'yc-hide-guide-footer',
};

function applySettings(settings) {
  YC.settings = settings;
  YC.blocklist = compileBlocklist(settings.useBlocklist ? settings : {});
  for (const [key, attribute] of Object.entries(CSS_SWITCHES)) {
    document.documentElement.toggleAttribute(attribute, settings.enabled && settings[key]);
  }
  runFeatures('apply');
  scanNow();
}

function runFeatures(hook) {
  for (const feature of YC.features) {
    try {
      feature[hook]?.();
    } catch (error) {
      console.warn('[YouChoose]', error);
    }
  }
}

let scanQueued = false;

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(runQueuedScan);
  setTimeout(runQueuedScan, 250); // animation frames don't run in background tabs
}

function runQueuedScan() {
  if (scanQueued) scanNow();
}

function scanNow() {
  scanQueued = false;
  if (YC.settings) runFeatures('scan');
}

function textOf(element) {
  return element ? element.textContent.trim() : '';
}

function showToast(message) {
  let toast = document.querySelector('.yc-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'yc-toast';
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('yc-toast-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('yc-toast-visible'), 3000);
}

new MutationObserver(queueScan).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('yt-navigate-start', () => runFeatures('navigateStart'));
document.addEventListener('yt-navigate-finish', () => {
  runFeatures('navigateFinish');
  queueScan();
});

loadSettings().then(applySettings);
onSettingsChanged(applySettings);
