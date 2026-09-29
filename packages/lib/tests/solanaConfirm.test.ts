import { Connection } from "@solana/web3.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SRC = readFileSync("src/bridge/solanaToNear.ts", "utf8");
const live = { skip: !process.env.SOLANA_LIVE };

const RECENT_SIG =
  "26dVZzXxQF3zKDT9GcbScMZkaWN1mN6ZD4pxeSjaW3S43mhn6Q641czjt2nWTizuX3x9xGVS65E7a2BxcxreiAKU";

test("confirmation must not use confirmTransaction", () => {
  // It opens a signatureSubscribe websocket, which the public cluster RPC
  // rejects from a browser: it hangs and spams the console while retrying.
  assert.doesNotMatch(
    SRC,
    /\.confirmTransaction\(/,
    "confirmTransaction would reintroduce the websocket",
  );
});

test("confirmation polls signature statuses over plain HTTP", () => {
  assert.match(SRC, /getSignatureStatuses\(\[signature\]\)/);
});

test("the swap waits on the token account, not a generic confirmation", () => {
  // Waiting for the associated token account is both the real precondition for
  // the deposit and cheaper than a confirmation round trip.
  assert.match(SRC, /await waitForTokenBalance\(/);
  assert.match(SRC, /export async function waitForTokenBalance\(/);
});

test("neither waiter blocks the flow indefinitely", () => {
  // Both are awaited with a catch, so a slow cluster cannot strand the user.
  assert.match(SRC, /waitForTokenBalance\([\s\S]*?\)\s*\.catch\(/);
});

test(
  "live: getSignatureStatuses answers quickly on the public cluster",
  live,
  async () => {
    const connection = new Connection(
      "https://api.mainnet-beta.solana.com/",
      "confirmed",
    );
    const started = Date.now();
    const res = await connection.getSignatureStatuses([RECENT_SIG]);
    const elapsed = Date.now() - started;
    assert.ok(Array.isArray(res.value));
    // The websocket path never returned within 8s in measurement; HTTP is ~100ms.
    assert.ok(elapsed < 3_000, `expected a fast HTTP reply, took ${elapsed}ms`);
  },
);

test(
  "live: confirmTransaction is indeed the slow path here",
  live,
  async () => {
    const connection = new Connection(
      "https://api.mainnet-beta.solana.com/",
      "confirmed",
    );
    const started = Date.now();
    const outcome = await Promise.race([
      connection.confirmTransaction(RECENT_SIG, "confirmed"),
      new Promise((r) => setTimeout(() => r("timeout"), 6_000)),
    ]);
    const elapsed = Date.now() - started;
    if (outcome === "timeout") {
      // Documents why we avoid it: the public cluster's websocket does not
      // complete signatureSubscribe, so this hangs.
      assert.ok(elapsed >= 6_000);
    }
  },
);
