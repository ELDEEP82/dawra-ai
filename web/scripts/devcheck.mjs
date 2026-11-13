// Dev-mode hydration check: React prints full hydration warnings only in development.
// Usage: (next dev -p 3124) then node scripts/devcheck.mjs [baseUrl]
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3124";
const PAGES = ["/", "/?lang=ar", "/en#plans", "/ar#evidence", "/en/farmer", "/ar/farmer", "/en/nasa-data", "/ar/nasa-data"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
let bad = 0;
for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  for (const path of PAGES) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const msgs = [];
    page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && msgs.push(m.text().slice(0, 200)));
    page.on("pageerror", (e) => msgs.push(String(e).slice(0, 200)));
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(2500);
    const hyd = msgs.filter((m) => /hydrat|did not match|server rendered/i.test(m));
    if (msgs.length) bad++;
    console.log(`${vp.width} ${path.padEnd(16)} hydration=${hyd.length} console=${msgs.length}${msgs.length ? "  " + msgs[0] : ""}`);
    await ctx.close();
  }
}
await browser.close().catch(() => undefined);
process.exit(bad ? 1 : 0);
