// Run with Playwright installed: node tests/browser-regressions.cjs
// Optional: PLAYWRIGHT_MODULE, CHROMIUM_PATH, YC_EXTENSION_DIR, YC_TEST_OUTPUT.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(process.env.YC_EXTENSION_DIR || path.join(__dirname, '..'));
const output = process.env.YC_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'youchoose-check-'));
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'youchoose-browser-'));
const original = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const svg = (frame, width = 640) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="360"><rect width="100%" height="100%" fill="${frame ? '#146b49' : '#ba2d2d'}"/><text x="20" y="60" font-size="24" fill="white">${frame ? 'Middle video frame' : 'Creator artwork'}</text></svg>`;
const card = id => `<ytd-video-renderer><a href="/watch?v=${id}" onclick="event.preventDefault();window.videoClicks++;history.pushState({},'',this.href);document.dispatchEvent(new Event('yt-navigate-finish'))"><img id="${id}" width="240" height="135" src="${original(id)}" srcset="${original(id)} 1x"></a><h3>Example video</h3></ytd-video-renderer>`;
const fixture = `<!doctype html><html lang="en"><meta charset="utf-8"><style>
body{background:#181818;color:#eee;font:14px Arial;padding:30px}#top-row,#actions,ytd-menu-renderer,#top-level-buttons-computed{display:flex;align-items:center;gap:8px}#top-row{justify-content:space-between}#owner{font-size:18px}#actions{flex:1;justify-content:flex-end}#actions-inner{display:flex;width:100%;height:36px;overflow:visible}ytd-menu-renderer{display:flex;flex:1;width:100%}#top-level-buttons-computed{display:flex;flex:none}#flexible-item-buttons{display:flex;flex:none}button{border:0;border-radius:22px;background:#333;color:#eee;padding:10px;font:14px Arial;display:flex;gap:8px}ytd-video-renderer{display:inline-block;margin:14px}img{object-fit:cover}#cards{margin-top:40px}
</style><body><ytd-watch-metadata><div id="above-the-fold"><div id="top-row"><div id="owner">Example channel</div><div id="actions"><div id="actions-inner"><ytd-menu-renderer><div id="top-level-buttons-computed">
<segmented-like-dislike-button-view-model style="display:flex"><like-button-view-model><button><span class="ButtonTextContent">502</span></button></like-button-view-model><dislike-button-view-model><button><span class="ButtonShapeNextIcon">Dislike</span></button></dislike-button-view-model></segmented-like-dislike-button-view-model>
<yt-button-view-model><button>Share</button></yt-button-view-model><yt-button-view-model id="native"><button class="you-chat-entrypoint-button" onclick="window.geminiClicks=(window.geminiClicks||0)+1">✦ Ask Gemini</button></yt-button-view-model></div><div id="flexible-item-buttons"><button>Save</button></div></ytd-menu-renderer></div></div></div><div id="bottom-row">Video description</div></div></ytd-watch-metadata>
<div id="cards">${['aaaaaaaaaaa', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee'].map(card).join('')}</div>
<ytd-player><img id="player" width="100" height="60" src="${original('ppppppppppp')}"></ytd-player><div id="avatar"><img id="avatar-image" width="50" height="50" src="${original('qqqqqqqqqqq')}"></div><ytd-thumbnail><img id="lazy" width="100" height="60"></ytd-thumbnail>
<script>
window.videoClicks=0;window.sourceMutations=0;
// Reproduce a competing thumbnail script restoring the creator source. Cap it
// so a regressed extension fails the assertion instead of freezing the browser.
const sourceGuard=new MutationObserver(records=>{for(const record of records){if(record.target.id!=='aaaaaaaaaaa')continue;window.sourceMutations++;if(window.sourceMutations>50){sourceGuard.disconnect();return}if(record.target.getAttribute('src')!=='${original('aaaaaaaaaaa')}')record.target.setAttribute('src','${original('aaaaaaaaaaa')}')}});
sourceGuard.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['src']});
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext(profile, {
    headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1280, height: 900 }, colorScheme: 'dark',
  });
  try {
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ blockedTitles: 'spoiler', hideShorts: false, useVideoThumbnails: false });
      startSummary = async videoId => { globalThis.testSummaryId = videoId; return { site: 'ChatGPT' }; };
    });
    let pendingFrame;
    await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await context.route('https://returnyoutubedislikeapi.com/**', route => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ likes: 502, dislikes: 13 }) }));
    await context.route('https://i.ytimg.com/**', route => {
      const url = route.request().url();
      if (url.includes('jjjjjjjjjjj/hq720_2')) { pendingFrame = route; return; }
      const missing = /ccccccccccc\/(hq720_2|maxres2|sd2|hq2)\.jpg/.test(url) || /ddddddddddd\/(hq720_2|maxres2)\.jpg/.test(url);
      return missing ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ contentType: 'image/svg+xml', body: svg(!url.includes('hqdefault'), /eeeeeeeeeee\/hq720_2/.test(url) ? 120 : 640) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    await page.waitForFunction(() => document.querySelector('.yc-dislike-text')?.textContent === '13');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup.locator('[data-key="useVideoThumbnails"]').check();
    // Give observers and image load/error fallbacks time to settle.
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.sourceMutations), 0, 'Thumbnail replacement must not fight source-restoring scripts.');
    console.log('PASS: no source mutation loop with competing thumbnail restoration.');
    const waitFrame = (selector, file) => page.waitForFunction(({selector, file}) => document.querySelector(selector).style.content.includes(file), { selector, file });
    await waitFrame('#aaaaaaaaaaa', 'hq720_2');
    await waitFrame('#ddddddddddd', 'sd2');
    await waitFrame('#eeeeeeeeeee', 'maxres2');
    assert.equal(await page.locator('#ccccccccccc').evaluate(img => img.style.content), '');
    assert.equal(await page.locator('#aaaaaaaaaaa').getAttribute('src'), original('aaaaaaaaaaa'));
    assert.equal(await page.locator('#aaaaaaaaaaa').getAttribute('srcset'), `${original('aaaaaaaaaaa')} 1x`);
    for (const id of ['player', 'avatar-image']) assert.equal(await page.locator(`#${id}`).evaluate(img => img.style.content), '');
    await page.locator('#aaaaaaaaaaa').screenshot({ path: path.join(output, 'middle-frame.png') });
    await page.locator('#aaaaaaaaaaa').click();
    assert.equal(await page.evaluate(() => window.videoClicks), 1);
    console.log('PASS: displayed middle frame, image click navigation, resolution/placeholder fallbacks, untouched original sources/player/avatar.');

    await page.locator('.yc-summary-action').waitFor();
    assert.equal(await page.locator('#top-level-buttons-computed > .yc-summary-action').count(), 1);
    assert.equal(await page.locator('#actions-inner > .yc-summary-action').count(), 0);
    for (const width of [1280, 720]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.locator('#native').isVisible());
      const box = await page.locator('#native').boundingBox();
      const summary = await page.locator('.yc-summary-action').boundingBox();
      assert(Math.abs((summary.y + summary.height / 2) - (box.y + box.height / 2)) < 2, 'Summary and Gemini must share the same row.');
      if (width === 1280) assert(summary.x + summary.width <= width, 'Summary must be visible without scrolling at desktop width.');
      const cropped = await page.locator('#actions button, .yc-ratio').evaluateAll(elements => elements.flatMap(el => {
        const box = el.getBoundingClientRect();
        const problems = [];
        for (let ancestor = el.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor), rect = ancestor.getBoundingClientRect();
          if (style.overflowY !== 'visible' && (box.top < rect.top - 1 || box.bottom > rect.bottom + 1)) problems.push(`${el.textContent}: clipped vertically by ${ancestor.id}`);
          if (style.overflowX !== 'visible' && (box.left < rect.left - 1 || box.right > rect.right + 1)) problems.push(`${el.textContent}: clipped horizontally by ${ancestor.id}`);
        }
        return problems;
      }));
      assert.deepEqual(cropped, [], 'Every control and the ratio bar must be fully visible.');
      await page.locator('#native button').click();
    }
    assert.equal(await page.evaluate(() => window.geminiClicks), 2);
    await page.locator('.yc-summary-action button').click();
    assert.equal(await worker.evaluate(() => testSummaryId), 'aaaaaaaaaaa');
    console.log('PASS: independent Gemini and YouChoose buttons work at wide/narrow widths.');

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(src => {
      const img = document.querySelector('#ddddddddddd');
      img.closest('a').href = '/watch?v=bbbbbbbbbbb'; img.src = src; img.srcset = `${src} 1x`;
    }, original('bbbbbbbbbbb'));
    await waitFrame('#ddddddddddd', '/bbbbbbbbbbb/hq720_2');
    await page.evaluate(html => document.querySelector('#cards').insertAdjacentHTML('beforeend', html), card('ggggggggggg'));
    await waitFrame('#ggggggggggg', 'hq720_2');
    await page.evaluate(src => document.querySelector('#lazy').src = src, original('fffffffffff'));
    await waitFrame('#lazy', 'hq720_2');
    await page.evaluate(() => {
      const img = document.querySelector('#lazy');
      img.removeAttribute('src');
    });
    await page.waitForFunction(() => !document.querySelector('#lazy').style.content);
    await page.evaluate(src => document.querySelector('#lazy').src = src, original('fffffffffff'));
    await waitFrame('#lazy', 'hq720_2');
    await popup.locator('[data-key="useVideoThumbnails"]').uncheck();
    await page.waitForFunction(() => !document.querySelector('#aaaaaaaaaaa').style.content);
    await popup.locator('[data-key="useVideoThumbnails"]').check();
    await waitFrame('#aaaaaaaaaaa', 'hq720_2');
    await popup.locator('[data-key="enabled"]').uncheck();
    await page.waitForFunction(() => !document.querySelector('.yc-summary-action') && !document.querySelector('#aaaaaaaaaaa').style.content);
    assert.equal(await page.locator('.yc-inline-actions').count(), 0);
    await popup.locator('[data-key="enabled"]').check();
    await page.locator('.yc-summary-action').waitFor();
    console.log('PASS: recycled cards, infinite scroll, lazy images and both off/on toggles.');

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options/options.html`);
    await options.locator('[data-key="useVideoThumbnails"]').uncheck();
    await popup.waitForFunction(() => !document.querySelector('[data-key="useVideoThumbnails"]').checked);
    await options.locator('[data-key="useVideoThumbnails"]').check();
    await page.evaluate(html => document.querySelector('#cards').insertAdjacentHTML('beforeend', html), card('jjjjjjjjjjj'));
    for (let tries = 0; !pendingFrame && tries < 30; tries++) await page.waitForTimeout(50);
    assert(pendingFrame, 'Delayed frame request started.');
    await popup.locator('[data-key="useVideoThumbnails"]').uncheck();
    await pendingFrame.fulfill({ contentType: 'image/svg+xml', body: svg(true) });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#jjjjjjjjjjj').evaluate(img => img.style.content), '');
    await worker.evaluate(() => chrome.storage.local.set({ summarizeWith: 'claude' }));
    await page.waitForFunction(() => document.querySelector('.yc-summary-action button').title.includes('Claude'));
    await page.locator('#ddddddddddd').click();
    await page.locator('.yc-summary-action button').click();
    assert.equal(await worker.evaluate(() => testSummaryId), 'bbbbbbbbbbb');
    assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('blockedTitles')).blockedTitles), 'spoiler');
    console.log('PASS: popup/options sync, late loads after disabling, SPA navigation, provider changes and preserved settings.');
    await page.screenshot({ path: path.join(output, 'watch-regression.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: no uncaught errors. Screenshots:', output);
  } finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
