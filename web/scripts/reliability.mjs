// First-load reliability suite (Playwright + local Chrome, no browser download).
// Usage: node scripts/reliability.mjs [baseUrl] [repeats]
// Modes: cold (cache disabled, storage cleared), incognito (fresh context), slow4g (DevTools "Slow 4G" throttling).
// Each mode × language (en, ar) × device (desktop, mobile) × repeats. Assertions per run:
//   1. initial HTML (first byte) has the right <html lang/dir> and every hero number
//   2. 1.5 s after navigation the globe is not blank (poster loaded, inline preview present, or 3D canvas visible)
//   3. no console errors / warnings / page errors (React hydration errors surface here as #418/#423/#425)
//   4. no hydration warnings
//   5. cumulative layout shift ≤ 0.05 (measured over the first 5 s)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const REPEATS = Number(process.argv[3] ?? 5);
const OUT = new URL("../../submission/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(OUT, { recursive: true });

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const MODES = ["cold", "incognito", "slow4g"];
const SLOW_4G = { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8, uploadThroughput: (750 * 1024 * 0.9) / 8 };
const HYDRATION = /hydrat|did not match|server rendered HTML|Minified React error #(418|423|425)/i;

async function heroNumbersInHtml(lang) {
  const url = lang === "ar" ? `${BASE}/?lang=ar` : `${BASE}/`;
  const html = await (await fetch(url, { headers: { "accept-language": "en-US,en;q=0.9" } })).text();
  const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "";
  const wantDir = lang === "ar" ? 'dir="rtl"' : 'dir="ltr"';
  const i = html.indexOf('data-testid="hero-stats"');
  const stats = i < 0 ? "" : html.slice(i, i + 8000);
  const nums = ["2.4", "8.35", "1,579"].filter((n) => !stats.includes(n));
  return { ok: htmlTag.includes(`lang="${lang}"`) && htmlTag.includes(wantDir) && nums.length === 0, missing: nums, htmlTag };
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const runs = [];
for (const mode of MODES) {
  for (const lang of ["en", "ar"]) {
    for (const [dev, opt] of Object.entries(DEVICES)) {
      for (let r = 0; r < REPEATS; r++) {
        const ctx = await browser.newContext({ ...opt, locale: "en-US" });
        await ctx.clearCookies();
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("Network.enable");
        if (mode === "cold" || mode === "slow4g") {
          await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
          await cdp.send("Network.clearBrowserCache");
          await cdp.send("Network.clearBrowserCookies");
        }
        if (mode === "slow4g") await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
        await page.addInitScript(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch {}
          window.__cls = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        const msgs = [];
        page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && msgs.push(`${m.type()}: ${m.text()}`));
        page.on("pageerror", (e) => msgs.push(`pageerror: ${e}`));
        const url = lang === "ar" ? `${BASE}/?lang=ar` : `${BASE}/`;
        const t0 = Date.now();
        await page.goto(url, { waitUntil: "commit", timeout: 60000 });
        await page.waitForTimeout(Math.max(0, 1500 - (Date.now() - t0)));
        const globe = await page.evaluate(() => {
          const box = document.querySelector('[data-testid="globe"]');
          const img = document.querySelector('[data-testid="globe-poster"]');
          const canvasWrap = document.querySelector('[data-testid="globe-canvas"]');
          if (!box) return { ok: false, how: "no globe element" };
          const r = box.getBoundingClientRect();
          const visible = r.width > 50 && r.height > 50;
          const poster = !!img && img.complete && img.naturalWidth > 0 && Number(getComputedStyle(img).opacity) > 0.05;
          const lqip = getComputedStyle(box).backgroundImage.startsWith("url(");
          const canvas = !!canvasWrap && Number(getComputedStyle(canvasWrap).opacity) > 0.95 && !!canvasWrap.querySelector("canvas");
          return { ok: visible && (poster || canvas || lqip), how: canvas ? "3d" : poster ? "poster" : lqip ? "preview" : "blank" };
        });
        await page.waitForLoadState("load", { timeout: 60000 }).catch(() => undefined);
        await page.waitForTimeout(mode === "slow4g" ? 6000 : 4000);
        const cls = await page.evaluate(() => window.__cls);
        // Info only: after the first pointer move, does the 3D globe cross-fade in (desktop, WebGL)?
        let globe3d = null;
        if (dev === "desktop" && mode !== "slow4g") {
          await page.mouse.move(400, 300);
          await page.mouse.move(420, 320);
          await page.waitForTimeout(3500);
          globe3d = await page.evaluate(() => {
            const w = document.querySelector('[data-testid="globe-canvas"]');
            return !!w && Number(getComputedStyle(w).opacity) > 0.95;
          });
        }
        const htmlLang = await page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
        const hydration = msgs.filter((m) => HYDRATION.test(m));
        const run = {
          mode, lang, dev, r,
          globe: globe.how,
          globeOk: globe.ok,
          globe3d,
          langOk: htmlLang === (lang === "ar" ? "ar/rtl" : "en/ltr"),
          consoleOk: msgs.length === 0,
          hydrationOk: hydration.length === 0,
          cls: Math.round(cls * 1000) / 1000,
          clsOk: cls <= 0.05,
          msgs: msgs.slice(0, 5),
        };
        runs.push(run);
        console.log(`${mode.padEnd(9)} ${lang} ${dev.padEnd(7)} #${r + 1}  globe=${run.globe}${run.globeOk ? "" : "✗"}  lang=${run.langOk ? "ok" : "✗"}  console=${run.consoleOk ? "ok" : "✗ " + run.msgs[0]}  cls=${run.cls}${run.clsOk ? "" : "✗"}`);
        await ctx.close();
      }
    }
  }
}
await browser.close().catch(() => undefined);

const html = { en: await heroNumbersInHtml("en"), ar: await heroNumbersInHtml("ar") };
const pass = (f) => runs.every(f);
const summary = {
  base: BASE,
  repeats: REPEATS,
  runs: runs.length,
  "1_hero_numbers_and_lang_in_initial_html": html.en.ok && html.ar.ok,
  "2_globe_never_blank_after_1.5s": pass((r) => r.globeOk),
  "3_no_console_errors_or_warnings": pass((r) => r.consoleOk),
  "4_no_hydration_warnings": pass((r) => r.hydrationOk && r.langOk),
  "5_cls_le_0.05": pass((r) => r.clsOk),
  max_cls: Math.max(...runs.map((r) => r.cls)),
  globe_states: runs.reduce((a, r) => ({ ...a, [r.globe]: (a[r.globe] ?? 0) + 1 }), {}),
  globe_3d_after_first_pointer_move: `${runs.filter((r) => r.globe3d).length}/${runs.filter((r) => r.globe3d !== null).length}`,
  html,
};
writeFileSync(`${OUT}reliability_report.json`, JSON.stringify({ summary, runs }, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(Object.entries(summary).filter(([k]) => /^\d_/.test(k)).every(([, v]) => v) ? 0 : 1);
