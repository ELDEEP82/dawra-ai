// Screenshot every section (desktop + mobile, EN + AR) and record console errors.
// Usage: node scripts/screens.mjs [baseUrl]   (uses the locally installed Chrome; no browser download)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3123";
const OUT = new URL("../../submission/screens/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(OUT, { recursive: true });

const SECTIONS = ["hero", "story-sat", "story-twin", "story-search", "story-stress", "farm", "plans", "whatif", "snapshot"];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const report = [];

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  for (const lang of ["en", "ar"]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vpName === "mobile" ? 2 : 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // horizontal overflow check
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    for (const id of SECTIONS) {
      if (id === "hero") {
        await page.evaluate(() => window.scrollTo(0, 0));
      } else {
        const el = await page.$(`#${id}`);
        if (!el) continue;
        await el.scrollIntoViewIfNeeded();
        await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: "start" }), id);
      }
      await page.waitForTimeout(id === "story-sat" ? 3500 : 900);
      await page.screenshot({ path: `${OUT}${vpName}_${lang}_${id}.png` });
    }
    // open the first plan explanation and screenshot it
    const card = await page.$("#plan-compromise [role=button]");
    if (card) {
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await (await page.$("#plan-compromise")).screenshot({ path: `${OUT}${vpName}_${lang}_card_front.png` });
      await card.click();
      await page.waitForTimeout(1200);
      await (await page.$("#plan-compromise")).screenshot({ path: `${OUT}${vpName}_${lang}_card_back.png` });
    }
    for (const path of ["/farmer", "/nasa-data"]) {
      await page.goto(`${BASE}${path}?lang=${lang}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      if (path === "/farmer") {
        for (const label of lang === "ar" ? ["زي محطة رأس سدر", "متوسطة", "الفلوس"] : ["Like the DRC station", "Medium", "Money"]) {
          await page.getByRole("button", { name: new RegExp(label) }).first().click();
          await page.waitForTimeout(500);
        }
        await page.waitForTimeout(1200);
      }
      await page.screenshot({ path: `${OUT}${vpName}_${lang}${path.replace("/", "_")}.png`, fullPage: path === "/farmer" });
    }
    report.push({ viewport: vpName, lang, overflowPx: overflow, errors });
    await ctx.close();
  }
}
// one hero shot with motion on (WebGL globe zoomed to Ras Sudr)
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5500);
  await page.screenshot({ path: `${OUT}desktop_en_hero_motion.png` });
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
