// Asserts the generated UnoCSS rules for the bridge sheet resolve to the exact
// colours that scripts/contrast.mjs validated, so the checked ratios describe
// what actually ships.
//
// Usage: node scripts/verify-sheet-css.mjs <path-to-generated-uno-css>
import { readFileSync } from "node:fs";

// Vite serves the virtual CSS module as a JS string: selectors arrive
// double-escaped and newlines are literal `\n`. Backslashes only ever escape
// selector characters, so strip them to make matching straightforward.
const raw = readFileSync(process.argv[2] ?? "/tmp/opencode/uno.raw", "utf8");
const css = raw.replace(/\\n/g, "\n").replace(/\\\\/g, "\\").replace(/\\/g, "");

const hex = (h) => {
  const s = h.replace("#", "");
  const f =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const over = (fg, a, bg) =>
  "#" +
  hex(fg)
    .map((c, i) =>
      Math.round(c * a + hex(bg)[i] * (1 - a))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/**
 * Find the declaration block for `selector`. Selectors can be comma-grouped, so
 * locate the token, then scan to the block that follows it.
 */
function blockOf(selector) {
  const token = "." + selector;
  let from = 0;
  for (;;) {
    const i = css.indexOf(token, from);
    if (i === -1) return null;
    // The character after the token must end the selector (`,` `:` `{` space).
    const next = css[i + token.length];
    if (next === "{" || next === "," || next === " " || next === ":") {
      const open = css.indexOf("{", i);
      if (open === -1) return null;
      const close = css.indexOf("}", open);
      return close === -1 ? null : css.slice(open + 1, close);
    }
    from = i + token.length;
  }
}

function exists(selector) {
  return blockOf(selector) !== null;
}

const toHex = (rgb) =>
  "#" +
  [rgb[1], rgb[2], rgb[3]]
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("");

/**
 * Pull the declared colour out of a rule, returning it composited over `bg` so
 * translucent utilities like `bg-white/5` resolve to the colour actually seen.
 */
function colorOf(selector, bg = "#ffffff") {
  const body = blockOf(selector);
  if (!body) return null;
  // Handles both `rgb(r g b)` and `rgb(r g b / a)`.
  const m = body.match(/rgb\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?/);
  if (!m) return null;
  const hex = toHex(m);
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  return alpha === 1 ? hex : over(hex, alpha, bg);
}

const PANEL = "#222222";
const CARD = over("#ffffff", 0.05, PANEL);
const CARD_STRONG = over("#ffffff", 0.1, PANEL);

let bad = 0;

// Every colour class used in the sheet must exist in the generated CSS.
const MUST_EXIST = [
  "text-shitzu-1",
  "text-shitzu-2",
  "text-shitzu-3",
  "text-red-300",
  "text-amber-300",
  "bg-white/5",
  "bg-white/10",
  "border-shitzu-4/45",
];

console.log("-- utilities present in generated CSS --");
for (const sel of MUST_EXIST) {
  const found = exists(sel);
  if (!found) bad++;
  console.log(`  ${sel.padEnd(22)} ${found ? "yes" : "MISSING"}`);
}

console.log("\n-- resolved text colours --");
const TEXT = [
  ["text-shitzu-1", CARD, 7],
  ["text-shitzu-2", CARD, 7],
  ["text-shitzu-3", CARD, 7],
  ["text-red-300", CARD, 4.5],
  ["text-amber-300", CARD, 4.5],
  ["text-shitzu-1", PANEL, 7],
  ["text-shitzu-2", PANEL, 7],
];
for (const [sel, bg, min] of TEXT) {
  const c = colorOf(sel, bg);
  if (!c) {
    console.log(`  ${sel.padEnd(22)} NOT FOUND`);
    bad++;
    continue;
  }
  const r = ratio(c, bg);
  const ok = r >= min;
  if (!ok) bad++;
  console.log(
    `  ${sel.padEnd(16)} on ${bg}  ${c}  ${r.toFixed(2).padStart(6)}:1  min ${min}  ${ok ? "ok" : "FAIL"}`,
  );
}

console.log("\n-- resolved surfaces --");
for (const [sel, expect] of [
  ["bg-white/5", CARD],
  ["bg-white/10", CARD_STRONG],
]) {
  const c = colorOf(sel, PANEL);
  const ok = c?.toLowerCase() === expect.toLowerCase();
  if (!ok) bad++;
  console.log(
    `  ${sel.padEnd(14)} ${c}  expected ${expect}  ${ok ? "ok" : "MISMATCH"}`,
  );
}

console.log(
  `\n${bad === 0 ? "CSS matches the validated palette." : `${bad} problem(s).`}`,
);
process.exit(bad ? 1 : 0);
