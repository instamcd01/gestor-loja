// requires: npm install --no-save playwright && npx playwright install chromium (deliberately not a package.json dependency, see README)
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const [, , url, nome] = process.argv;
if (!url || !nome) {
  console.error("Uso: node scripts/screenshot.mjs <url> <nome>");
  process.exit(1);
}

await mkdir(".superpowers/screenshots", { recursive: true });

const browser = await chromium.launch();

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desktop.goto(url, { waitUntil: "networkidle" });
  await desktop.screenshot({ path: `.superpowers/screenshots/${nome}-desktop.png`, fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobile.goto(url, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: `.superpowers/screenshots/${nome}-mobile.png`, fullPage: true });
  await mobile.close();

  console.log(`Salvo: ${nome}-desktop.png e ${nome}-mobile.png`);
} finally {
  await browser.close();
}
