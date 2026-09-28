import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fromSol, getSolBalance, toSol } from "../src/lib/solana/balance.ts";

const live = { skip: !process.env.SOLANA_LIVE };
// No configured endpoint: exercise the same default the app falls back to.
const rpc = clusterApiUrl("devnet");

test("the default RPC is the public cluster endpoint", () => {
  const w = readFileSync("src/lib/solana/wallet.ts", "utf8");
  // No env var is required: the cluster URL is the default.
  assert.match(
    w,
    /import\.meta\.env\.VITE_SOLANA_RPC_URL \|\| clusterApiUrl\(network\)/,
  );
  // clusterApiUrl is inconsistent about a trailing slash between clusters, so
  // compare the origin rather than the full string.
  const origin = (u: string) => new URL(u).origin;
  assert.equal(
    origin(clusterApiUrl("mainnet-beta")),
    "https://api.mainnet-beta.solana.com",
  );
  assert.equal(
    origin(clusterApiUrl("devnet")),
    "https://api.devnet.solana.com",
  );
});

test("mainnet meme.cooking deploys inject a keyed Solana RPC", () => {
  for (const mode of ["production", "staging"]) {
    const wf = readFileSync(
      `.github/workflows/deploy-meme-${mode}.yml`,
      "utf8",
    );
    // Appended to the mode-specific file, or `vite build --mode <mode>` never
    // sees it.
    assert.match(
      wf,
      new RegExp(
        `VITE_SOLANA_RPC_URL=\\$VITE_SOLANA_RPC_URL.*>> \\.env\\.${mode}`,
      ),
      mode,
    );
    assert.match(wf, /secrets\.VITE_SOLANA_RPC_URL/, mode);
  }
});

test("testnet stays on the devnet cluster", () => {
  // The secret is a mainnet provider, so injecting it here would point the
  // testnet build at mainnet. Devnet answers browser requests without a key.
  const wf = readFileSync(".github/workflows/deploy-meme-testnet.yml", "utf8");
  assert.doesNotMatch(wf, /VITE_SOLANA_RPC_URL/);
});

test("the public devnet cluster answers balance queries", live, async () => {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const lamports = await getSolBalance(
    connection,
    new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"),
  );
  assert.ok(lamports >= 0n);
});

test("lamport <-> SOL conversion round-trips", () => {
  assert.equal(toSol(BigInt(LAMPORTS_PER_SOL)), 1);
  assert.equal(toSol(0n), 0);
  assert.equal(fromSol(1), BigInt(LAMPORTS_PER_SOL));
  assert.equal(fromSol(0.5), 500_000_000n);
  assert.equal(toSol(fromSol(2.25)), 2.25);
});

test(
  "a valid but unused address has a zero balance, not an error",
  live,
  async () => {
    const connection = new Connection(rpc, "confirmed");
    // System program address: exists, but holds no lamports.
    const address = new PublicKey("11111111111111111111111111111112");
    const balance = await getSolBalance(connection, address);
    assert.equal(typeof balance, "bigint");
    assert.ok(balance >= 0n);
  },
);

test("live: a random address resolves without throwing", live, async () => {
  const connection = new Connection(rpc, "confirmed");
  const address = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
  const lamports = await getSolBalance(connection, address);
  assert.ok(lamports >= 0n, "expected a non-negative lamport balance");
});
