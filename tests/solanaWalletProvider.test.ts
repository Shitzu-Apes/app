import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const WALLET = "src/lib/solana/wallet.ts";
const src = readFileSync(WALLET, "utf8");

/**
 * `publicKey$` and the AnchorProvider must always move together. A connected
 * wallet with a null provider looks correct in the UI (address shown, balances
 * load) but fails when it tries to sign, which is what the bridge hit after an
 * auto-connect on page reload.
 */
test("all wallet state mutations go through applyWallet", () => {
  const setters = src.match(/_selectedWallet\$\.set|_publicKey\$\.set/g) ?? [];
  assert.equal(
    setters.length,
    2,
    "selectedWallet$/publicKey$ should each be written exactly once",
  );
});

test("only applyWallet writes the stores", () => {
  const applyStart = src.indexOf("private applyWallet(");
  const updateStart = src.indexOf("private updateProvider(");
  assert.ok(
    applyStart > -1 && updateStart > applyStart,
    "expected both methods",
  );

  const applyBody = src.slice(applyStart, updateStart);
  assert.match(applyBody, /_selectedWallet\$\.set\(wallet\)/);
  assert.match(
    applyBody,
    /_publicKey\$\.set\(wallet\?\.publicKey \?\? undefined\)/,
  );
  // The whole point: the provider is refreshed in the same breath.
  assert.match(applyBody, /this\.updateProvider\(\)/);
});

test("applyWallet is used by every connect and disconnect path", () => {
  const callers = src.match(/this\.applyWallet\(/g) ?? [];
  // connect event, disconnect event, autoConnect, connect(), disconnect()
  assert.equal(callers.length, 5, "expected all 5 call sites to be routed");
  assert.match(src, /private applyWallet\(/, "expected a single definition");
});

test("autoConnect routes through applyWallet", () => {
  // This was the bug: autoConnect set the stores but never called
  // updateProvider, so a reload left publicKey$ set with a null provider.
  const start = src.indexOf("private async autoConnect()");
  const end = src.indexOf("public async connect(");
  const body = src.slice(start, end);
  assert.match(body, /this\.applyWallet\(wallet\)/);
  assert.doesNotMatch(body, /_publicKey\$\.set/);
});

test("a publicKey without a selected wallet can never be observed", () => {
  // applyWallet derives the key from the wallet, so the two are always
  // consistent by construction rather than by remembering to update both.
  const applyStart = src.indexOf("private applyWallet(");
  const updateStart = src.indexOf("private updateProvider(");
  const applyBody = src.slice(applyStart, updateStart);
  assert.match(applyBody, /wallet\?\.publicKey/);
});

test("connected$ still tracks our own public key", () => {
  assert.match(
    src,
    /connected\$ = derived\(this\._publicKey\$, \(k\) => k != null\)/,
  );
});
