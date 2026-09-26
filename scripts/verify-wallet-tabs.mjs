// Proves which wallet tabs each app gets, by replaying what each workflow
// appends at build time and evaluating the real predicates from
// WalletSelector.svelte.
//
// Only TRACKED .env files are used, because Vite's loadEnv also reads the
// gitignored .env.local, which does not exist in CI. Including it here would
// silently apply a developer's local overrides to every app.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const isMultichain = (v) => v === undefined || v !== "false";
const showEvm = (v, mc) => (v === undefined ? mc : v !== "false");

/** Parse a tracked .env file into a plain object. */
function readTrackedEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Collect `echo "K=V" >> .env...` appends from a workflow. */
function ciAppends(workflow) {
  const src = readFileSync(workflow, "utf8");
  const out = {};
  for (const m of src.matchAll(
    /echo "([A-Z0-9_]+)=([^"]*)"\s*>>\s*\.env\.?(\w*)/g,
  )) {
    const [, key, value] = m;
    if (value.includes("secrets.")) continue; // injected by CI, not a flag
    out[key] = value;
  }
  return out;
}

// Guard: refuse to run if .env.local is tracked, since that would invalidate
// this simulation.
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.startsWith(".env"));
if (tracked.some((f) => f.includes(".local"))) {
  console.error("A local .env file is tracked; this simulation is invalid.");
  process.exit(1);
}

const APPS = [
  {
    name: "shitzu (app.shitzuapes.xyz)",
    mode: "production",
    wf: ".github/workflows/deploy-shitzu-app.yml",
    evm: true,
  },
  {
    name: "meme.cooking production",
    mode: "production",
    wf: ".github/workflows/deploy-meme-production.yml",
    evm: false,
  },
  {
    name: "meme.cooking staging",
    mode: "staging",
    wf: ".github/workflows/deploy-meme-staging.yml",
    evm: false,
  },
  {
    name: "meme.cooking testnet",
    mode: "testnet",
    wf: ".github/workflows/deploy-meme-testnet.yml",
    evm: false,
  },
];

let bad = 0;
for (const app of APPS) {
  // `vite build` with no --mode defaults to "production".
  const env = {
    ...readTrackedEnv(".env"),
    ...readTrackedEnv(`.env.${app.mode}`),
    ...ciAppends(app.wf),
  };

  const mc = isMultichain(env.VITE_WALLET_SELECTOR_MULTICHAIN);
  const evm = showEvm(env.VITE_WALLET_SELECTOR_EVM, mc);
  const tabs = ["NEAR", ...(mc ? ["Solana"] : []), ...(evm ? ["EVM"] : [])];

  console.log(`\n${app.name}   (vite build --mode ${app.mode})`);
  console.log(`  MULTICHAIN = ${env.VITE_WALLET_SELECTOR_MULTICHAIN}`);
  console.log(`  EVM flag   = ${env.VITE_WALLET_SELECTOR_EVM ?? "(unset)"}`);
  console.log(`  tabs: ${tabs.join(", ")}`);

  const ok = evm === app.evm && (app.evm || mc);
  if (!ok) {
    console.log(`  !! expected EVM=${app.evm}`);
    bad++;
  }
}

console.log(
  `\n${bad === 0 ? "PASS: shitzu keeps EVM; meme.cooking drops it but keeps Solana." : `${bad} failure(s).`}`,
);
process.exit(bad ? 1 : 0);
