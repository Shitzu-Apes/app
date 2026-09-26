import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SELECTOR = "src/lib/auth/WalletSelector.svelte";
const HEADER = "src/lib/layout/memecooking/MCHeader.svelte";
const SOLANA_WALLET = "src/lib/solana/wallet.ts";

const src = (f: string) => readFileSync(f, "utf8");

test("EVM has its own flag, independent of multichain", () => {
  const s = src(SELECTOR);
  assert.match(s, /VITE_WALLET_SELECTOR_EVM/);
  // The EVM tab must be gated on the EVM flag, not on isMultichain.
  assert.match(s, /\{#if showEvm\}[\s\S]*?handleNetworkChange\("evm"\)/);
});

test("the EVM tab falls back to multichain when the flag is unset", () => {
  const s = src(SELECTOR);
  assert.match(
    s,
    /VITE_WALLET_SELECTOR_EVM === undefined\s*\?\s*isMultichain/,
    "unset EVM flag should follow multichain",
  );
});

test("a hidden EVM tab cannot be selected via initialNetwork", () => {
  const s = src(SELECTOR);
  assert.match(
    s,
    /initialNetwork === "evm" && !showEvm \? "near"/,
    "must fall back to near when evm is hidden",
  );
});

test("meme.cooking workflows enable Solana but hide EVM", () => {
  for (const mode of ["production", "staging", "testnet"]) {
    const wf = src(`.github/workflows/deploy-meme-${mode}.yml`);
    assert.match(wf, /VITE_WALLET_SELECTOR_MULTICHAIN=true/, mode);
    assert.match(wf, /VITE_WALLET_SELECTOR_EVM=false/, mode);
  }
});

test("the shitzu app is untouched by the EVM flag", () => {
  // The EVM tab must still work where it is supported.
  for (const mode of ["production", "staging", "testnet"]) {
    const wf = src(`.github/workflows/deploy-shitzu-app.yml`);
    assert.doesNotMatch(wf, /VITE_WALLET_SELECTOR_EVM=false/, mode);
  }
});

test("the header no longer offers a NEAR-only sign out", () => {
  const h = src(HEADER);
  assert.doesNotMatch(h, /nearWallet\.signOut/, "signOut should be gone");
  // The account affordance must reopen the wallet dialog so any connected
  // chain (including Solana) can be disconnected from one place.
  assert.match(h, /showWalletSelector\("shitzu"\)/);
});

test("solana connected state derives from our own public key", () => {
  const w = src(SOLANA_WALLET);
  // Deriving from the adapter's mutable `connected` field could disagree with
  // publicKey$, which is what hides the disconnect button.
  assert.match(
    w,
    /connected\$ = derived\(this\._publicKey\$, \(k\) => k != null\)/,
  );
  assert.doesNotMatch(w, /connected\$ = derived\(\s*this\._selectedWallet\$/);
});

test("the wallet selector still exposes a Solana disconnect", () => {
  const s = src(SELECTOR);
  assert.match(s, /Disconnect Solana Wallet/);
});
