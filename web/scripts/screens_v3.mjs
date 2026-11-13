// v3 screenshots: hero + every tab, EN + AR, at 1280×720, 1440×900 and 390×844 → submission/screens/v3/.
// Also reports horizontal overflow, console errors and text clipped by its box.
// Usage: node scripts/screens_v3.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const OUT = new URL("../../submission/screens/v3/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(OUT, { recursive: true });
const VPS = { "1280x720": { width: 1280, height: 720 }, "1440x900": { width: 1440, height: 900 }, "390x844": { width: 390, height: 844 } };
const TABS = ["farm", "plans", "whatif", "evidence", "nasa"];
const report = [];

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [vpName, vp] of Object.entries(VPS)) {
  const mobile = vp.width < 640;
  for (const lang of ["en", "ar"]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}${vpName}_${lang}_hero.png` });
    const fold = await page.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? -1;
      return { stats: r('[data-testid="hero-stats"]'), cta: r(".btn-primary"), h1Lines: Math.round(document.querySelector("h1").getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector("h1")).lineHeight)) };
    });
    for (const tab of TABS) {
      if (mobile) await page.click(`nav[aria-label] .grid > button:nth-child(${TABS.indexOf(tab) + 1})`);
      else await page.click(`#tab-${tab}`);
      await page.waitForTimeout(tab === "evidence" ? 3000 : 1200);
      // scroll through the panel like a visitor so in-view animations run, then back to the tabs
      const h = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < h; y += vp.height * 0.8) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(150);
      }
      await page.evaluate(() => window.scrollTo(0, document.getElementById("app-top").getBoundingClientRect().top + window.scrollY - 64));
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth - window.innerWidth;
        const clipped = [...document.querySelectorAll("[role=tabpanel] h3, [role=tabpanel] p, [role=tabpanel] button, [role=tabpanel] span")]
          .filter((e) => e.offsetParent && !e.classList.contains("sr-only") && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === "hidden" && !e.className.toString().includes("truncate"))
          .slice(0, 5)
          .map((e) => e.textContent.slice(0, 40));
        return { over, clipped, hash: location.hash };
      });
      await page.screenshot({ path: `${OUT}${vpName}_${lang}_${tab}.png`, fullPage: true });
      await page.screenshot({ path: `${OUT}${vpName}_${lang}_${tab}_view.png` });
      report.push({ vp: vpName, lang, tab, ...info });
    }
    report.push({ vp: vpName, lang, fold, errors: errors.slice(0, 5) });
    console.log(vpName, lang, JSON.stringify(fold), errors.length ? errors.slice(0, 3) : "no console errors");
    await ctx.close();
  }
}
await browser.close().catch(() => undefined);
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.filter((r) => r.over > 0 || r.clipped?.length || r.errors?.length || (r.hash !== undefined && r.hash !== `#${r.tab}`)), null, 2));
