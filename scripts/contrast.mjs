// WCAG contrast checker for the bridge sheet palette.
// Run: node scripts/contrast.mjs
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

const PANEL = "#222222"; // BottomSheet variant="shitzu" -> bg-dark
const CARD = over("#ffffff", 0.05, PANEL); // bg-white/5
const CARD_STRONG = over("#ffffff", 0.1, PANEL); // bg-white/10

const S = {
  1: "#d2f9e5",
  2: "#a9f1d0",
  3: "#72e3b6",
  4: "#31c891",
  500: "#15b47f",
  600: "#099267",
};

let failures = 0;
function check(label, fg, bg) {
  const r = ratio(fg, bg);
  const grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA-large" : "FAIL";
  if (grade === "FAIL") failures++;
  console.log(
    `${label.padEnd(44)} ${r.toFixed(2).padStart(6)}:1  ${grade}${
      grade === "FAIL" ? "   <-- must fix" : ""
    }`,
  );
}

console.log(`panel        ${PANEL}`);
console.log(`card         ${CARD}   (bg-white/5)`);
console.log(`card strong  ${CARD_STRONG}   (bg-white/10)\n`);

console.log("-- text on card (bg-white/5) --");
check("heading / amount  shitzu-1", S[1], CARD);
check("body + helper      shitzu-2", S[2], CARD);
check("labels + Max       shitzu-3", S[3], CARD);
check("input placeholder  shitzu-500", S[500], CARD);
check("error              red-300", "#fca5a5", CARD);
check("warning            amber-300", "#fcd34d", CARD);

console.log("\n-- text on panel (#222) --");
check("section base       shitzu-1", S[1], PANEL);
check("fine print         shitzu-2", S[2], PANEL);

console.log("\n-- buttons --");
check("primary label      black on shitzu-4", "#000000", S[4]);
check("disabled label     shitzu-3 on bg-white/10", S[3], CARD_STRONG);
check("source chip active black on shitzu-4", "#000000", S[4]);
check("source chip idle   shitzu-1 on bg-white/5", S[1], CARD);

console.log("\n-- surface separation (cards must read as a layer) --");
for (const [n, c] of [
  ["card vs panel", CARD],
  ["card strong vs panel", CARD_STRONG],
]) {
  const r = ratio(c, PANEL);
  const ok = r >= 1.15;
  if (!ok) failures++;
  console.log(
    `${n.padEnd(44)} ${r.toFixed(2).padStart(6)}:1  ${ok ? "visible" : "TOO FLAT"}`,
  );
}
console.log(
  `border shitzu-4/45 vs panel                        ${ratio(
    over(S[4], 0.45, PANEL),
    PANEL,
  )
    .toFixed(2)
    .padStart(6)}:1  visible`,
);

console.log(
  `\n${failures === 0 ? "All checks pass." : `${failures} check(s) FAILED.`}`,
);
process.exit(failures ? 1 : 0);
