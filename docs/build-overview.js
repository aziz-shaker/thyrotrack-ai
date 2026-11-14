// Builds docs/ThyroTrack-AI-Project-Overview.pdf from project-overview.html (images embedded).
// Usage (from web/ so playwright resolves):  node ../docs/build-overview.js
const fs = require("fs");
const path = require("path");
const { chromium } = require(path.join(__dirname, "../web/node_modules/playwright"));

const dir = __dirname;
let html = fs.readFileSync(path.join(dir, "project-overview.html"), "utf8");

for (const name of ["landing", "dashboard", "review", "patient"]) {
  const b64 = fs.readFileSync(path.join(dir, "images", `${name}.png`)).toString("base64");
  html = html.replace(`{{IMG_${name}}}`, `data:image/png;base64,${b64}`);
}
html = html.replace(
  "{{LOGO_LINES}}",
  Array.from({ length: 9 }, (_, i) => `<rect x="0" y="${4 + i * 3.6}" width="48" height="2.2" rx="1.1" fill="${i % 3 === 1 ? "#0E9FDC" : "#0A3D57"}"/>`).join(""),
);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(dir, "ThyroTrack-AI-Project-Overview.pdf");
  await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log("written", out);
})();
