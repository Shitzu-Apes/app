import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, beforeEach } from "node:test";
import { addresses, resetConfig, setConfig, setNetwork } from "omni-bridge-sdk";

// The SDK hardcodes rpc.near.org for every view call and builds a fresh client
// per call, ignoring both the wallet selector and VITE_NODE_URL. Those calls sit
// between the user's click and the wallet popup, so a slow node means the popup
// opens outside the gesture window and the browser blocks it.

const SLOW_DEFAULT = "https://rpc.near.org";

// setConfig writes module-global state in the SDK, so every test starts from a
// known baseline rather than inheriting the previous one's override.
beforeEach(() => {
  resetConfig();
  setNetwork("mainnet");
});
afterEach(() => {
  resetConfig();
  setNetwork("mainnet");
});

test("the SDK defaults to the slow public RPC", () => {
  // Guards the premise: if a future SDK release picks a faster default, or
  // starts honouring fallbackRpcUrls, the override can be revisited.
  assert.deepEqual(addresses.near.rpcUrls, [SLOW_DEFAULT]);
});

test("setConfig redirects the NEAR RPC without disturbing the contracts", () => {
  const contractBefore = addresses.near.contract;

  setConfig({ near: { rpcUrls: ["https://rpc.example.test"] } });

  assert.deepEqual(addresses.near.rpcUrls, ["https://rpc.example.test"]);
  // The override must not leak into anything else the SDK reads from here.
  assert.equal(addresses.near.contract, contractBefore);
  assert.equal(addresses.near.contract, "omni.bridge.near");
  assert.ok(addresses.sol.locker, "solana locker must survive");
});

test("the bridge points the SDK at the app's own node", () => {
  const src = readFileSync("src/bridge/omni.ts", "utf8");
  assert.match(src, /setConfig\(\{ near: \{ rpcUrls: \[nodeUrl\] \} \}\)/);
  // Guarded, so a missing env var cannot leave the SDK with rpcUrls: [undefined].
  // The optional chain matters too: this module is imported by tests, where
  // import.meta.env does not exist outside Vite.
  assert.match(
    src,
    /const nodeUrl = import\.meta\.env\?\.VITE_NODE_URL;\nif \(nodeUrl\) \{/,
  );
});
