import assert from "node:assert/strict";
import test from "node:test";

const { catalogSignature, shouldBuildCatalog, shouldLoadWallet } = await import(
  "../src/lib/bridge/walletLoad.ts"
);

// The boolean that decides whether balances load at all. It was asked to re-read
// whenever the token list was empty, which reads like a retry and cannot be one: a
// failed read changes neither the public key nor the list, so re-assigning equal
// values marks nothing dirty and the block never re-runs. The loader retries an
// empty read itself, where an attempt actually happens.

test("a connected wallet is read once", () => {
  assert.equal(
    shouldLoadWallet({
      publicKey: "So1",
      loadedFor: null,
      loadInFlight: false,
    }),
    true,
    "first time",
  );
  assert.equal(
    shouldLoadWallet({
      publicKey: "So1",
      loadedFor: "So1",
      loadInFlight: false,
    }),
    false,
    "already read",
  );
});

test("a wallet that changes is read again", () => {
  assert.equal(
    shouldLoadWallet({
      publicKey: "So2",
      loadedFor: "So1",
      loadInFlight: false,
    }),
    true,
  );
  // Including mid-load: switching accounts during a read must not leave the new
  // account showing the old one's balances.
  assert.equal(
    shouldLoadWallet({
      publicKey: "So2",
      loadedFor: "So1",
      loadInFlight: true,
    }),
    true,
  );
});

test("an empty list is not a reason to read again", () => {
  // The loader retries an empty read itself, because a rejected RPC arrives as a
  // *successful* read of an empty list, and only an attempt tells that apart from a
  // wallet that holds nothing. A guard cannot make the attempt.
  assert.equal(
    shouldLoadWallet({
      publicKey: "So1",
      loadedFor: "So1",
      loadInFlight: false,
    }),
    false,
  );
});

test("a read in flight is not started twice", () => {
  assert.equal(
    shouldLoadWallet({
      publicKey: "So1",
      loadedFor: "So1",
      loadInFlight: true,
    }),
    false,
  );
});

test("no wallet means no read", () => {
  assert.equal(
    shouldLoadWallet({ publicKey: null, loadedFor: null, loadInFlight: false }),
    false,
  );
  assert.equal(
    shouldLoadWallet({
      publicKey: null,
      loadedFor: "So1",
      loadInFlight: false,
    }),
    false,
  );
});

// The destination list is *built* with the balances folded in and then held, unlike the
// spend side which is derived and re-renders. So a wallet read landing after the build
// changed nothing on that side while the derived side updated normally — both reading
// the same arrays, and only one re-reading them. Toggling the destination was the only
// thing that made it rebuild, which is why it looked like the chain switch was the fix.

test("a fresh set of balances is a different signature", () => {
  const base = { chain: "solana", wallet: "So1" };
  assert.equal(
    catalogSignature({ ...base, version: 1 }),
    catalogSignature({ ...base, version: 1 }),
    "the same balances are the same signature",
  );
  assert.notEqual(
    catalogSignature({ ...base, version: 1 }),
    catalogSignature({ ...base, version: 2 }),
    "a new read is a new signature",
  );
});

test("the signature separates chains, and separates accounts", () => {
  // The same balances belong to one account, so switching accounts has to rebuild even
  // when the token count is identical.
  assert.notEqual(
    catalogSignature({ chain: "near", wallet: "So1", version: 1 }),
    catalogSignature({ chain: "solana", wallet: "So1", version: 1 }),
  );
  assert.notEqual(
    catalogSignature({ chain: "solana", wallet: "So1", version: 1 }),
    catalogSignature({ chain: "solana", wallet: "So2", version: 1 }),
  );
  // No wallet yet is a state of its own, distinct from any account.
  assert.notEqual(
    catalogSignature({ chain: "solana", wallet: null, version: 1 }),
    catalogSignature({ chain: "solana", wallet: "So1", version: 1 }),
  );
});

test("the list is rebuilt when the balances move, not only when the chain does", () => {
  const base = {
    hydrated: true,
    chain: "solana",
    builtFor: "solana" as string | null,
  };
  // The bug: same chain, same signature, so nothing was rebuilt and the amounts that
  // arrived after the build never appeared.
  assert.equal(
    shouldBuildCatalog({
      ...base,
      builtFrom: "solana|So1|1",
      signature: "solana|So1|1",
    }),
    false,
    "nothing changed",
  );
  assert.equal(
    shouldBuildCatalog({
      ...base,
      builtFrom: "solana|So1|1",
      signature: "solana|So1|2",
    }),
    true,
    "the balances arrived, so rebuild",
  );
  assert.equal(
    shouldBuildCatalog({
      ...base,
      builtFor: null,
      builtFrom: "",
      signature: "x",
    }),
    true,
    "never built",
  );
});

test("a chain change rebuilds whatever the balances say", () => {
  assert.equal(
    shouldBuildCatalog({
      hydrated: true,
      chain: "near",
      builtFor: "solana",
      builtFrom: "solana|So1|2",
      signature: "near|mario.near|2",
    }),
    true,
  );
});

test("nothing is built before the URL has been read", () => {
  // `dest` starts on its default and is corrected from the query in `onMount`, so
  // building before then asks for the wrong chain, and the aborted first request comes
  // back empty and overwrites the list the link asked for.
  assert.equal(
    shouldBuildCatalog({
      hydrated: false,
      chain: "solana",
      builtFor: null,
      builtFrom: "",
      signature: "solana|So1|1",
    }),
    false,
  );
});
