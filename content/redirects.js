// Page redirects: open Shorts in the normal player, and keep the Explore/Trending pages away.
// (Hiding Shorts and Explore entries is pure CSS — see youchoose.css.)

function shortsWatchUrl(href) {
  const id = new URL(href, location.origin).pathname.match(/^\/shorts\/([\w-]{11})/);
  return id ? `/watch?v=${id[1]}` : null;
}

function redirectsActive(key) {
  return YC.isTopFrame && YC.on && YC.settings[key];
}

function redirectPage() {
  const watchUrl = redirectsActive('redirectShorts') && shortsWatchUrl(location.href);
  if (watchUrl) {
    location.replace(watchUrl);
  } else if (redirectsActive('hideExplore') && /^\/feed\/(trending|explore)/.test(location.pathname)) {
    location.replace('/');
  }
}

// Catch clicks on Shorts links before YouTube opens its Shorts player.
document.addEventListener(
  'click',
  (event) => {
    if (!redirectsActive('redirectShorts') || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href*="/shorts/"]');
    const watchUrl = link && shortsWatchUrl(link.href);
    if (!watchUrl) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(watchUrl);
  },
  true,
);

YC.features.push({ apply: redirectPage, navigateFinish: redirectPage });
