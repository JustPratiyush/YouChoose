// Turns the blocklist text boxes into matchers.
// One entry per line: "// ..." lines are notes, "/pattern/flags" is a regular expression,
// anything else is a case-insensitive whole-word match.

function parseLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));
}

const REGEX_LINE = /^\/(.+)\/([dgimsuvy]*)$/;
const NO_SPACE_SCRIPTS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

function toRegex(line) {
  const literal = line.match(REGEX_LINE);
  if (literal) {
    try {
      return new RegExp(literal[1], literal[2].replace('g', ''));
    } catch {
      return null;
    }
  }
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Scripts written without spaces between words can't be matched by whole word.
  if (NO_SPACE_SCRIPTS.test(line)) return new RegExp(escaped, 'iu');
  return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${escaped}($|[^\\p{L}\\p{M}\\p{N}])`, 'iu');
}

function matchesAny(regexes, ...texts) {
  return regexes.some((re) => texts.some((text) => text && re.test(text)));
}

// "UC…" channel ID or lower-cased "@handle" from an entry, link or URL; null for plain names.
function channelKey(value) {
  const text = String(value || '').trim();
  const id = text.match(/(?:^|\/channel\/)(UC[\w-]{22})(?:$|[/?#])/);
  if (id) return id[1];
  const handle = text.match(/(?:^|\/)(@[^/?#\s]+)/);
  if (!handle) return null;
  try {
    return decodeURIComponent(handle[1]).toLowerCase();
  } catch {
    return handle[1].toLowerCase();
  }
}

function videoIdFrom(value) {
  const text = String(value || '').trim();
  const match =
    text.match(/(?:[?&]v=|\/shorts\/|youtu\.be\/|\/embed\/|\/live\/)([\w-]{11})/) ||
    text.match(/^([\w-]{11})$/);
  return match ? match[1] : null;
}

// Channels: IDs and @handles must match exactly, anything else is matched against the channel name.
function compileChannels(text) {
  const ids = new Set();
  const names = [];
  for (const line of parseLines(text)) {
    const key = REGEX_LINE.test(line) ? null : channelKey(line);
    if (key) {
      ids.add(key);
    } else {
      const re = toRegex(line);
      if (re) names.push(re);
    }
  }
  return { ids, names };
}

// channel = { name, ids: [UC… / @handle, ...] }
function matchesChannel(list, channel) {
  return channel.ids.some((id) => list.ids.has(id)) || matchesAny(list.names, channel.name);
}

function compileBlocklist(settings) {
  return {
    channels: compileChannels(settings.blockedChannels),
    titles: parseLines(settings.blockedTitles).map(toRegex).filter(Boolean),
    videos: new Set(parseLines(settings.blockedVideos).map(videoIdFrom).filter(Boolean)),
    comments: parseLines(settings.blockedComments).map(toRegex).filter(Boolean),
  };
}
