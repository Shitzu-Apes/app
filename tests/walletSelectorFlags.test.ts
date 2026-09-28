import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SELECTOR = "src/lib/auth/WalletSelector.svelte";
const HEADER = "src/lib/layout/memecooking/MCHeader.svelte";
const SOLANA_WALLET = "src/lib/solana/wallet.ts";
const NEAR_WALLET = "src/lib/near/wallet.ts";

const src = (f: string) => readFileSync(f, "utf8");

test("Intear's logout-bridge call cannot block wallet setup", () => {
  // The blank NEAR tab. Intear checks a third-party service for a cross-tab
  // logout with a fetch that has no timeout. The check runs from the Intear
  // wallet constructor, which core reaches on every page load via
  // setupStorage -> resolveStorageState -> validateWallet -> getWallet ->
  // setupInstance -> module.init. setupWalletSelector awaits setupStorage, so
  // when logout-bridge-service.intear.tech is unreachable the fetch never
  // settles, setupWalletSelector never resolves, and the module list never
  // arrives: an empty NEAR tab for anyone who had connected Intear, in every
  // app, on every deploy. The service was fully unreachable (all requests
  // timed out), which is what set it off.
  const w = src(NEAR_WALLET);
  assert.match(
    w,
    /setupIntearWallet\(\{\s*\n\s*logoutBridgeService: `\$\{window\.location\.origin\}/,
    "the logout bridge must be pointed somewhere that fails fast",
  );
  assert.doesNotMatch(
    w.replace(/^\s*\/\/.*$/gm, ""),
    /logout-bridge-service\.intear\.tech/,
    "must not call the unreachable third-party host",
  );
});

test("an instant-link module is not registered as a selector module", () => {
  // Keypom was registered, and its factory does an un-timed `await connect(...)`
  // plus a second RPC call. core wraps factories in .catch, which handles a
  // rejection but not a promise that never settles: Promise.all waits forever,
  // the selector never resolves, and the NEAR tab renders nothing at all with
  // no error anywhere. It could not even show up in the list, because modules$
  // discards every `instant-link` module, so it was pure downside.
  const w = src(NEAR_WALLET);
  assert.doesNotMatch(w, /@keypom\/one-click-connect/);
  assert.doesNotMatch(w, /setupOneClickConnect/);
  // The module type the filter drops is still handled, so a future instant-link
  // module cannot reintroduce the crash either.
  assert.match(w, /case "instant-link":\s*\n\s*return;/);
});

test("the NEAR tab is not a blank box when the list cannot load", () => {
  // Solana and EVM are on synchronous paths, so only NEAR could go blank, and
  // it had no pending branch and no catch: a rejection or a hang produced an
  // empty panel indistinguishable from "you have no wallets".
  const s = src(SELECTOR);
  assert.match(
    s,
    /\{#await \$modules\$\}\s*\n\s*<p[^>]*>\s*\n?\s*Loading NEAR wallets/,
  );
  assert.match(s, /\{:catch err\}/);
  assert.match(s, /Could not load NEAR wallets/);
  // An empty-but-resolved list is also called out.
  assert.match(s, /\{#if mods\.length === 0\}/);
});

test("an unknown module id cannot take down the whole NEAR list", () => {
  // `NEAR_WALLETS[mod.id].name` threw a TypeError mid-each when the id had no
  // entry, which destroyed the entire list rather than skipping one row.
  const s = src(SELECTOR);
  assert.match(
    s,
    /const walletMeta = \(id: string\) => NEAR_WALLETS\[id\] \?\? \{\}/,
  );
  assert.doesNotMatch(s, /NEAR_WALLETS\[mod\.id\]\./);
});

test("EVM gating lives in capabilities.ts, not inline in the selector", () => {
  const s = src(SELECTOR);
  assert.match(
    s,
    /import \{ shouldShowEvm \} from "\$lib\/auth\/capabilities"/,
  );
  assert.match(s, /const showEvm = shouldShowEvm\(isMultichain\)/);
  // The EVM tab must be gated on showEvm, not on isMultichain directly.
  assert.match(s, /\{#if showEvm\}[\s\S]*?handleNetworkChange\("evm"\)/);
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
