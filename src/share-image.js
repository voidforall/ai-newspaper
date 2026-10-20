import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { escapeXml } from "./distribution.js";

function titleLines(text, maximumWidth = 18, maximumLines = 4) {
  const lines = [];
  let line = "", width = 0;
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((item) => item.segment);
  for (const character of graphemes) {
    const advance = /[^\x00-\x7F]|[MWmw]/u.test(character) ? 1 : /\s/.test(character) ? 0.35 : /[A-Z]/.test(character) ? 0.75 : 0.65;
    if (width + advance > maximumWidth && line) {
      if (lines.length === maximumLines - 1) { line = `${line.slice(0, -1)}…`; break; }
      lines.push(line.trim()); line = ""; width = 0;
    }
    line += /\s/.test(character) ? " " : character;
    width += advance;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function renderShareImage({ title, date, url, label = "AI Builder 日报" }) {
  const lines = titleLines(title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f5f0e5"/>
<g fill="#181715" font-family="Newspaper Sans">
<text x="64" y="72" font-size="28" font-weight="700">${escapeXml(label)}</text>
<path d="M64 96H1136M64 102H1136" stroke="#24211c"/>
<text x="64" y="151" font-size="23" fill="#a1261f">${escapeXml(date)}</text>
${lines.map((line, index) => `<text x="64" y="${232 + index * 76}" font-size="58" font-weight="700">${escapeXml(line)}</text>`).join("\n")}
<path d="M64 544H1136" stroke="#24211c"/>
<text x="64" y="589" font-size="22">${escapeXml(titleLines(new URL(url).host + new URL(url).pathname.replace(/\/$/, ""), 46, 1)[0])}</text>
</g></svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: [fileURLToPath(new URL("../assets/fonts/NewspaperSans.ttf", import.meta.url))], defaultFontFamily: "Newspaper Sans" } }).render().asPng();
}
