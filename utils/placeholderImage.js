// utils/placeholderImage.js

const COLOR_PALETTE = [
  { name: "red",     bg: "#fee2e2", text: "#7f1d1d" },
  { name: "orange",  bg: "#ffedd5", text: "#7c2d12" },
  { name: "amber",   bg: "#fef3c7", text: "#78350f" },
  { name: "yellow",  bg: "#fef9c3", text: "#713f12" },
  { name: "lime",    bg: "#ecfccb", text: "#365314" },
  { name: "green",   bg: "#dcfce7", text: "#14532d" },
  { name: "emerald", bg: "#d1fae5", text: "#064e3b" },
  { name: "teal",    bg: "#ccfbf1", text: "#134e4a" },
  { name: "cyan",    bg: "#cffafe", text: "#164e63" },
  { name: "sky",     bg: "#e0f2fe", text: "#0c4a6e" },
  { name: "blue",    bg: "#dbeafe", text: "#1e3a8a" },
  { name: "indigo",  bg: "#e0e7ff", text: "#312e81" },
  { name: "violet",  bg: "#ede9fe", text: "#4c1d95" },
  { name: "purple",  bg: "#f3e8ff", text: "#581c87" },
  { name: "fuchsia", bg: "#fae8ff", text: "#701a75" },
  { name: "pink",    bg: "#fce7f3", text: "#831843" },
  { name: "rose",    bg: "#ffe4e6", text: "#881337" },
  { name: "slate",   bg: "#f1f5f9", text: "#0f172a" },
  { name: "gray",    bg: "#f3f4f6", text: "#111827" },
];

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Simple word-wrap helper — long text ko multiple lines me todta hai
function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((w) => {
    if ((line + " " + w).trim().length > maxChars) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  });
  if (line) lines.push(line);
  return lines;
}

export function generatePlaceholderImage(examText = "Exam", titleText = "", opts = {}) {
  const width = opts.width || 800;
  const height = opts.height || 450;

  // Random color pair
  const palette = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];

  // Exam text — max 2 lines
  const examLines = wrapText((examText || "EXAM").toUpperCase(), 14).slice(0, 2);
  const examFontSize = examLines.length > 1 ? 56 : 68;
  const lineHeight = examFontSize * 1.15;
  const startY = height / 2 - ((examLines.length - 1) * lineHeight) / 2 - 15;

  const examTspans = examLines
    .map((line, i) => `<tspan x="50%" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const titleLine = titleText ? escapeXml(wrapText(titleText, 40)[0]) : "";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${palette.bg}" />
  <text x="50%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${examFontSize}" fill="${palette.text}" letter-spacing="2">
    ${examTspans}
  </text>
  ${titleLine ? `<text x="50%" y="${height / 2 + 70}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="22" fill="${palette.text}" opacity="0.85">${titleLine}</text>` : ""}
</svg>`.trim();

  const base64 = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}