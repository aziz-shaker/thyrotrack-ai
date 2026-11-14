// Render a docs/*.html file to PDF with Chromium (Arabic shaping + RTL handled by the browser).
// Usage (from web/ so playwright resolves):  node ../docs/build-pdf.js <input.html> <output.pdf>
const fs = require("fs");
const path = require("path");
const { chromium } = require(path.join(__dirname, "../web/node_modules/playwright"));

const [input = "project-overview.html", output = path.join(__dirname, "out.pdf")] = process.argv.slice(2);
let html = fs.readFileSync(path.resolve(__dirname, input), "utf8");

// Embed screenshots referenced as {{IMG_name}} → docs/images/name.png
html = html.replace(/\{\{IMG_([a-z0-9-]+)\}\}/g, (_, n) => `data:image/png;base64,${fs.readFileSync(path.join(__dirname, "images", `${n}.png`)).toString("base64")}`);
// Logo: thyroid shape filled with horizontal scan lines
const lines = (a, b) => Array.from({ length: 9 }, (_, i) => `<rect x="0" y="${4 + i * 3.6}" width="48" height="2.2" rx="1.1" fill="${i % 3 === 1 ? a : b}"/>`).join("");
html = html.replace("{{LOGO_LINES}}", lines("#0E9FDC", "#0A3D57")).replace("{{LOGO_LINES_LIGHT}}", lines("#62C6EE", "#FFFFFF"));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: output, format: "A4", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log("written", output);
})();
