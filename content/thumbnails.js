// Display YouTube's middle automatic still without rewriting YouTube's image sources.
// Source rewrites can fight YouTube or another extension in a MutationObserver loop,
// starving the event loop so that even clicks stop working.
(() => {
  const THUMBNAIL = /\/vi(?:_webp)?\/([\w-]{11})\//;
  const FILES = ['hq720_2', 'maxres2', 'sd2', 'hq2'];
  const images = new Map();
  const frames = new Map();
  let observing = false;

  function enabled() {
    return YC.on && YC.settings.useVideoThumbnails;
  }

  function loadFrame(url) {
    return new Promise((resolve) => {
      const image = new Image();
      const timer = setTimeout(() => finish(false), 5000);
      function finish(available) {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        resolve(available);
      }
      // Some missing resolutions return a tiny placeholder with HTTP 200.
      image.onload = () => finish(image.naturalWidth >= 320);
      image.onerror = () => finish(false);
      image.src = url;
    });
  }

  function frameFor(videoId) {
    if (!frames.has(videoId)) {
      const result = (async () => {
        for (const file of FILES) {
          const url = `https://i.ytimg.com/vi/${videoId}/${file}.jpg`;
          if (await loadFrame(url)) return url;
        }
        return null;
      })();
      frames.set(videoId, result);
      if (frames.size > 500) frames.delete(frames.keys().next().value);
    }
    return frames.get(videoId);
  }

  function restore(img, state) {
    // Restore only our own style, preserving any subsequent external change.
    if (state.applied && img.style.getPropertyValue('content') === state.applied) {
      if (state.original) img.style.setProperty('content', state.original, state.priority);
      else img.style.removeProperty('content');
    }
    state.applied = null;
  }

  function release(img) {
    const state = images.get(img);
    if (!state) return;
    images.delete(img);
    visible.unobserve(img);
    restore(img, state);
  }

  async function render(img, state) {
    const videoId = state.videoId;
    const url = await frameFor(videoId);
    if (!enabled() || images.get(img) !== state || state.videoId !== videoId || !img.isConnected) return;
    if (url) {
      // CSS replaces only the displayed bitmap. The original img, src, srcset,
      // link and YouTube's click/hover handlers remain intact. No overlay is added.
      img.style.setProperty('content', `url("${url}")`);
      state.applied = img.style.getPropertyValue('content');
    }
  }

  const visible = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const state = images.get(entry.target);
      if (!state) continue;
      state.visible = true;
      visible.unobserve(entry.target);
      render(entry.target, state);
    }
  }, { rootMargin: '600px' });

  function consider(img) {
    const source = img.getAttribute('src') || img.getAttribute('srcset') || '';
    const match = source.match(THUMBNAIL);
    if (!match || img.closest('ytd-player, #movie_player, .html5-video-player, #avatar, ytd-channel-name, yt-avatar-shape, a#channel-thumbnail')) {
      release(img);
      return;
    }
    const videoId = videoIdFrom(img.closest('a[href]')?.getAttribute('href')) || match[1];
    let state = images.get(img);
    if (!state) {
      state = {
        videoId, visible: false, applied: null,
        original: img.style.getPropertyValue('content'),
        priority: img.style.getPropertyPriority('content'),
      };
      images.set(img, state);
      visible.observe(img);
    } else if (state.videoId !== videoId) {
      restore(img, state);
      state.videoId = videoId;
      if (state.visible) render(img, state);
    }
  }

  // Batch external source/link changes through the core scheduler. Never write to
  // attributes observed here, and never process mutations recursively.
  const observer = new MutationObserver(queueScan);
  YC.features.push({
    apply() {
      if (enabled()) {
        if (!observing) {
          observer.observe(document.documentElement, {
            subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'href'],
          });
          observing = true;
        }
      } else {
        observer.disconnect();
        visible.disconnect();
        observing = false;
        for (const img of images.keys()) release(img);
      }
    },
    scan() {
      for (const img of images.keys()) {
        if (!img.isConnected) release(img);
        else if (enabled()) consider(img);
      }
      if (!enabled()) return;
      document.querySelectorAll('img[src*="/vi/"], img[src*="/vi_webp/"], img[srcset*="/vi/"], img[srcset*="/vi_webp/"]').forEach((img) => {
        if (!images.has(img)) consider(img);
      });
    },
  });
})();
