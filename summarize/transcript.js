// Fetches a YouTube video's details and captions (loaded into the background worker).
//
// Main path: ask YouTube's player API as the mobile app for the caption tracks. YouTube's web
// caption links now need a proof-of-origin token, but the app's links don't. A session rule sets
// the Origin header on these requests so YouTube accepts them.
// Backup path: open the video in a muted background tab with the user's normal YouTube session,
// have the player load captions, and reuse the player's own caption request.

const PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const ORIGIN_RULE_ID = 1;

const CLIENTS = [
  { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30 },
  {
    clientName: 'IOS',
    clientVersion: '20.10.4',
    deviceMake: 'Apple',
    deviceModel: 'iPhone16,2',
    osName: 'iPhone',
    osVersion: '18.3.2.22D82',
  },
];

class TranscriptError extends Error {
  /** @param {'NO_CAPTIONS'|'UNAVAILABLE'|'BLOCKED'|'EMPTY'|'NETWORK'} code */
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const noCaptionsError = () =>
  new TranscriptError(
    "This video has no subtitles or auto-generated captions, so there's no transcript to summarize.",
    'NO_CAPTIONS',
  );

// YouTube's player API rejects requests whose Origin is chrome-extension://…
async function ensureOriginRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ORIGIN_RULE_ID],
    addRules: [
      {
        id: ORIGIN_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{ header: 'origin', operation: 'set', value: 'https://www.youtube.com' }],
        },
        condition: {
          urlFilter: '||www.youtube.com/youtubei/',
          initiatorDomains: [chrome.runtime.id],
          resourceTypes: ['xmlhttprequest', 'other'],
        },
      },
    ],
  });
}

async function fetchPlayerResponse(videoId) {
  let lastProblem = null;
  for (const client of CLIENTS) {
    let data;
    try {
      const res = await fetch(PLAYER_URL, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { ...client, hl: 'en' } },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
      });
      if (!res.ok) {
        lastProblem = { code: 'BLOCKED', message: `YouTube responded with HTTP ${res.status}.` };
        continue;
      }
      data = await res.json();
    } catch (err) {
      lastProblem = { code: 'NETWORK', message: `Couldn't reach YouTube (${err.message}).` };
      continue;
    }

    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const status = data?.playabilityStatus?.status;
    if (tracks.length || status === 'OK') return { data, tracks };

    const reason = data?.playabilityStatus?.reason || status || 'unknown reason';
    lastProblem =
      status === 'ERROR'
        ? { code: 'UNAVAILABLE', message: `YouTube says this video is unavailable: ${reason}` }
        : { code: 'BLOCKED', message: `YouTube wouldn't share this video's details: ${reason}` };
  }
  throw new TranscriptError(lastProblem.message, lastProblem.code);
}

function trackLabel(track) {
  return track?.name?.simpleText ?? track?.name?.runs?.map((r) => r.text).join('') ?? track.languageCode;
}

/**
 * Preference order: creator-made captions in the preferred language, auto-generated captions in
 * the preferred language, creator-made captions in the spoken language, auto-generated captions,
 * then anything at all.
 */
function pickTrack(tracks, preferredLang = 'en') {
  const pref = preferredLang.trim().toLowerCase();
  const lang = (t) => t.languageCode.toLowerCase();
  const isPreferred = (t) => lang(t) === pref || lang(t).startsWith(`${pref}-`);
  const manual = tracks.filter((t) => t.kind !== 'asr');
  const auto = tracks.filter((t) => t.kind === 'asr');
  const spoken = auto[0] && lang(auto[0]).split('-')[0];

  return (
    manual.find(isPreferred) ||
    auto.find(isPreferred) ||
    (spoken && manual.find((t) => lang(t).split('-')[0] === spoken)) ||
    auto[0] ||
    manual[0]
  );
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntitiesOnce(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    const cp = /^#x/i.test(entity) ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
  });
}

function cleanCaptionText(raw) {
  // Caption XML is often double-encoded (&amp;#39;), so decode twice.
  const text = decodeEntitiesOnce(decodeEntitiesOnce(raw.replace(/<[^>]+>/g, '')));
  return text.replace(/\s+/g, ' ').trim();
}

/** Parses YouTube timedtext: JSON (fmt=json3), or XML format 1 `<text start dur>` / format 3 `<p t d>`. */
function parseTimedText(body) {
  if (body.trimStart().startsWith('{')) {
    let events = [];
    try {
      events = JSON.parse(body).events ?? [];
    } catch {
      return [];
    }
    return events
      .filter((e) => e.segs)
      .map((e) => ({
        start: (e.tStartMs ?? 0) / 1000,
        dur: (e.dDurationMs ?? 0) / 1000,
        text: e.segs.map((s) => s.utf8 ?? '').join('').replace(/\s+/g, ' ').trim(),
      }))
      .filter((s) => s.text);
  }

  const attr = (attrs, name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  const segments = [];
  for (const [, attrs, text] of body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    segments.push({
      start: parseFloat(attr(attrs, 'start') ?? '0'),
      dur: parseFloat(attr(attrs, 'dur') ?? '0'),
      text: cleanCaptionText(text),
    });
  }
  if (!segments.length) {
    for (const [, attrs, text] of body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
      segments.push({
        start: parseInt(attr(attrs, 't') ?? '0', 10) / 1000,
        dur: parseInt(attr(attrs, 'd') ?? '0', 10) / 1000,
        text: cleanCaptionText(text),
      });
    }
  }
  return segments.filter((s) => s.text);
}

async function fetchSegments(track) {
  let body;
  try {
    const res = await fetch(track.baseUrl.replace(/&fmt=[^&]*/g, ''), { credentials: 'omit' });
    body = await res.text();
  } catch (err) {
    throw new TranscriptError(`Couldn't download the captions (${err.message}).`, 'NETWORK');
  }
  const segments = parseTimedText(body);
  if (!segments.length) throw new TranscriptError('YouTube returned an empty caption file for this video.', 'EMPTY');
  return segments;
}

/**
 * @typedef {{videoId: string, title: string, channel: string, durationSec: number,
 *   description: string, language: string, languageCode: string, isAutoGenerated: boolean,
 *   segments: {start: number, dur: number, text: string}[]}} Transcript
 * @returns {Transcript}
 */
function assembleTranscript(videoId, videoDetails, track, segments) {
  const details = videoDetails ?? {};
  return {
    videoId,
    title: details.title || 'Untitled video',
    channel: details.author || 'Unknown channel',
    durationSec: Number(details.lengthSeconds) || 0,
    description: details.shortDescription || '',
    language: trackLabel(track),
    languageCode: track.languageCode,
    isAutoGenerated: track.kind === 'asr',
    segments,
  };
}

async function getTranscriptDirect(videoId, preferredLang) {
  await ensureOriginRule();
  const { data, tracks } = await fetchPlayerResponse(videoId);
  if (!tracks.length) throw noCaptionsError();
  const track = pickTrack(tracks, preferredLang);
  return assembleTranscript(videoId, data.videoDetails, track, await fetchSegments(track));
}

// ---- backup path: a muted background YouTube tab ----

/** Resolves once the tab finishes loading. */
function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const done = (fn, arg) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      fn(arg);
    };
    const onUpdated = (id, info) => id === tabId && info.status === 'complete' && done(resolve);
    const timer = setTimeout(() => done(reject, new Error('Timed out waiting for the page to load.')), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function runInTab(tabId, func, args = [], world = 'ISOLATED') {
  const [injection] = await chrome.scripting.executeScript({ target: { tabId }, world, func, args });
  return injection?.result;
}

// Runs in the YouTube page's main world, so it must be self-contained.
async function captureCaptionRequest() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // YouTube clears the performance buffer as it goes, so watch for new entries too.
  const captionUrls = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => u.includes('/api/timedtext'));
  const observer = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.name.includes('/api/timedtext')) captionUrls.push(e.name);
  });
  observer.observe({ type: 'resource' });

  let player = null;
  for (let i = 0; i < 80; i++) {
    const p = document.querySelector('#movie_player');
    if (p?.getPlayerResponse?.()?.videoDetails) {
      player = p;
      break;
    }
    await sleep(250);
  }
  if (!player) {
    observer.disconnect();
    return { error: "YouTube's player didn't load." };
  }

  try {
    player.pauseVideo();
  } catch {}
  const response = player.getPlayerResponse();
  const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const d = response.videoDetails;
  const result = {
    details: { title: d.title, author: d.author, lengthSeconds: d.lengthSeconds, shortDescription: d.shortDescription },
    tracks: tracks.map((t) => ({ languageCode: t.languageCode, kind: t.kind, name: t.name, vssId: t.vssId })),
    captionUrl: null,
  };
  if (!tracks.length) {
    observer.disconnect();
    return result;
  }

  // YouTube remembers caption choices in localStorage; put the user's settings back afterwards.
  const savedPrefs = Object.keys(localStorage)
    .filter((k) => /caption/i.test(k))
    .map((k) => [k, localStorage.getItem(k)]);

  // Re-selecting an already loaded track is served from cache, so each attempt forces a fresh
  // request: load the module, reload it, then ask for a translation (tlang is stripped later).
  const lang = tracks[0].languageCode;
  const attempts = [
    () => player.loadModule('captions'),
    () => player.setOption('captions', 'track', { languageCode: lang }),
    () => {
      player.unloadModule('captions');
      player.loadModule('captions');
      player.setOption('captions', 'track', { languageCode: lang });
    },
    () =>
      player.setOption('captions', 'track', {
        languageCode: lang,
        translationLanguage: { languageCode: lang === 'fr' ? 'de' : 'fr' },
      }),
  ];
  for (const attempt of attempts) {
    if (captionUrls.length) break;
    try {
      attempt();
    } catch {}
    for (let i = 0; i < 16 && !captionUrls.length; i++) await sleep(250);
  }
  observer.disconnect();
  result.captionUrl = captionUrls.at(-1) ?? null;

  try {
    player.unloadModule('captions');
    for (const k of Object.keys(localStorage)) if (/caption/i.test(k)) localStorage.removeItem(k);
    for (const [k, v] of savedPrefs) localStorage.setItem(k, v);
  } catch {}
  return result;
}

async function fetchInPage(url) {
  const res = await fetch(url, { credentials: 'include' });
  return res.ok ? res.text() : '';
}

async function getTranscriptViaTab(videoId, preferredLang) {
  const tab = await chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}`, active: false });
  try {
    const loaded = waitForTabComplete(tab.id, 30_000);
    await chrome.tabs.update(tab.id, { muted: true }).catch(() => {});
    await loaded;

    const page = await runInTab(tab.id, captureCaptionRequest, [], 'MAIN');
    if (!page || page.error) throw new TranscriptError(page?.error ?? "Couldn't read the YouTube page.", 'BLOCKED');
    if (!page.tracks.length) throw noCaptionsError();
    if (!page.captionUrl) throw new TranscriptError("YouTube's player wouldn't load the captions.", 'BLOCKED');

    const track = pickTrack(page.tracks, preferredLang);
    const url = new URL(page.captionUrl);
    url.searchParams.set('lang', track.languageCode);
    if (track.kind) url.searchParams.set('kind', track.kind);
    else url.searchParams.delete('kind');
    url.searchParams.delete('tlang');
    url.searchParams.set('fmt', 'json3');

    const segments = parseTimedText((await runInTab(tab.id, fetchInPage, [url.href], 'MAIN')) ?? '');
    if (!segments.length) throw new TranscriptError('YouTube returned an empty caption file for this video.', 'EMPTY');
    return assembleTranscript(videoId, page.details, track, segments);
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// Errors where YouTube itself has answered definitively; anything else is worth a retry via a tab.
const FINAL_TRANSCRIPT_ERRORS = new Set(['NO_CAPTIONS', 'UNAVAILABLE']);

/** @returns {Promise<Transcript>} */
async function fetchTranscript(videoId, preferredLang = 'en') {
  try {
    return await getTranscriptDirect(videoId, preferredLang);
  } catch (err) {
    if (FINAL_TRANSCRIPT_ERRORS.has(err.code)) throw err;
    console.warn('[YouChoose] Direct transcript fetch failed, trying through a YouTube tab:', err);
    return getTranscriptViaTab(videoId, preferredLang);
  }
}
