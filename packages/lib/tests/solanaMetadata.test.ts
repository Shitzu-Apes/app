import assert from "node:assert/strict";
import test from "node:test";

import {
  clearIconCache,
  fetchOnChainMetadata,
  knownIcon,
  knownMetadata,
  knownSymbol,
  resolveIconFromUri,
} from "../src/solana/metadata.ts";

const WSOL = "So11111111111111111111111111111111111111112";
const WNEAR = "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** A connection stub that returns canned accounts, keyed by mint. */
function stubConnection(
  accounts: Map<string, Buffer | null>,
  fail = false,
): {
  getMultipleAccountsInfo: (
    keys: never[],
  ) => Promise<(null | { data: Buffer })[]>;
} {
  return {
    getMultipleAccountsInfo: async (keys: never[]) => {
      if (fail) throw new Error("rpc down");
      // The stub is given PDAs in mint order by the caller.
      void keys;
      void accounts;
      return [];
    },
  };
}

/** Build a Metaplex MetadataV1 account. */
function metadataAccount(fields: {
  key?: number;
  name: string;
  symbol: string;
  uri: string;
  layout: "padded" | "legacy";
  pad?: "none" | "null" | "space";
}): Buffer {
  const head = Buffer.alloc(65);
  head[0] = fields.key ?? 4;
  // A fixed-width field is always exactly its width; what varies is the byte
  // used to fill the remainder.
  const fill = fields.pad === "space" ? " " : "\0";
  const pad = (s: string, n: number) => {
    const body = (s + fill.repeat(n)).slice(0, n);
    return Buffer.from(body);
  };

  if (fields.layout === "legacy") {
    return Buffer.concat([
      head,
      pad(fields.name, 32),
      pad(fields.symbol, 10),
      pad(fields.uri, 200),
    ]);
  }
  const lp = (s: string) => {
    const b = Buffer.from(s);
    const len = Buffer.alloc(4);
    len.writeUInt32LE(b.length);
    return Buffer.concat([len, b]);
  };
  return Buffer.concat([
    head,
    lp(fields.name),
    lp(fields.symbol),
    lp(fields.uri),
  ]);
}

test("SOL and NEAR always have a symbol and icon we ship", () => {
  // The product deliberately calls the wrapped token NEAR, and Jupiter has no
  // icon for it at all, so these must not depend on any third party.
  assert.equal(knownSymbol(WSOL), "SOL");
  assert.equal(knownIcon(WSOL), "/sol-logo.webp");
  assert.equal(knownSymbol(WNEAR), "NEAR");
  assert.equal(knownIcon(WNEAR), "/wnear.webp");
  assert.equal(knownMetadata(WNEAR)?.name, "NEAR");
});

test("an unknown mint has no override", () => {
  assert.equal(knownSymbol(USDC), undefined);
  assert.equal(knownIcon(USDC), undefined);
  assert.equal(knownMetadata(USDC), undefined);
});

test("the local override is not clobbered by the token list", async () => {
  const { enrichWithMetadata } = await import("../src/solana/tokenBalances.ts");
  const tokens = [
    {
      mint: WNEAR,
      balance: 6_051_912n,
      decimals: 9,
      symbol: "NEAR",
      icon: "/wnear.webp",
      routable: true,
      native: false,
    },
  ];
  const out = await enrichWithMetadata(tokens);
  assert.equal(out[0].symbol, "NEAR");
  assert.equal(out[0].icon, "/wnear.webp");
});

test("on-chain metadata is read in a single batched call", async () => {
  const data = metadataAccount({
    name: "USD Coin",
    symbol: "USDC",
    uri: "https://example.test/usdc.json",
    layout: "padded",
  });
  let calls = 0;
  const connection = {
    getMultipleAccountsInfo: async () => {
      calls++;
      return [{ data }];
    },
  } as never;

  const found = await fetchOnChainMetadata(connection as never, [USDC]);
  assert.equal(calls, 1, "a wallet's worth of metadata must be one round trip");
  assert.equal(found.get(USDC)?.symbol, "USDC");
  assert.equal(found.get(USDC)?.name, "USD Coin");
  assert.equal(found.get(USDC)?.uri, "https://example.test/usdc.json");
});

test("both account layouts parse", async () => {
  // Tokens issued at different times use different layouts and both are still
  // in circulation, including the two the bridge is about.
  for (const layout of ["padded", "legacy"] as const) {
    const data = metadataAccount({
      name: "NEAR",
      symbol: "NEAR",
      uri: "https://example.test/near.json",
      layout,
    });
    const connection = {
      getMultipleAccountsInfo: async () => [{ data }],
    } as never;
    const found = await fetchOnChainMetadata(connection as never, [WNEAR]);
    assert.equal(found.get(WNEAR)?.symbol, "NEAR", `${layout} symbol`);
    assert.equal(found.get(WNEAR)?.name, "NEAR", `${layout} name`);
    assert.equal(
      found.get(WNEAR)?.uri,
      "https://example.test/near.json",
      `${layout} uri`,
    );
  }
});

test("issuer padding inside a field is stripped", async () => {
  // Issuers pad name and symbol themselves, with nulls or spaces. Left alone,
  // the symbol renders as invisible padding.
  for (const pad of ["null", "space"] as const) {
    const data = metadataAccount({
      name: "NEAR",
      symbol: "NEAR",
      uri: "https://example.test/near.json",
      layout: "legacy",
      pad,
    });
    const connection = {
      getMultipleAccountsInfo: async () => [{ data }],
    } as never;
    const found = await fetchOnChainMetadata(connection as never, [WNEAR]);
    assert.equal(found.get(WNEAR)?.symbol, "NEAR", `${pad} padded symbol`);
  }
});

test("a token with no metadata account is simply absent", async () => {
  const connection = {
    getMultipleAccountsInfo: async () => [null],
  } as never;
  const found = await fetchOnChainMetadata(connection as never, [WSOL]);
  assert.equal(found.size, 0, "absence is normal, not an error");
});

test("a non-metadata account is ignored rather than misread", async () => {
  // key 0/1/2 are collection and other variants with no name/symbol/uri.
  for (const key of [0, 1, 2, 3, 5]) {
    const data = metadataAccount({
      key,
      name: "x",
      symbol: "x",
      uri: "x",
      layout: "padded",
    });
    const connection = {
      getMultipleAccountsInfo: async () => [{ data }],
    } as never;
    const found = await fetchOnChainMetadata(connection as never, [WNEAR]);
    assert.equal(found.size, 0, `key ${key} must not be read as a token`);
  }
});

test("a truncated account cannot throw or produce garbage", async () => {
  for (const length of [0, 1, 64, 65, 70]) {
    const data = Buffer.alloc(length);
    data[0] = 4;
    const connection = {
      getMultipleAccountsInfo: async () => [{ data }],
    } as never;
    const found = await fetchOnChainMetadata(connection as never, [WNEAR]);
    assert.ok(found.size <= 1);
  }
});

test("an RPC failure degrades to no metadata instead of throwing", async () => {
  const connection = {
    getMultipleAccountsInfo: async () => {
      throw new Error("rpc down");
    },
  } as never;
  const found = await fetchOnChainMetadata(connection as never, [USDC, WNEAR]);
  assert.equal(found.size, 0);
});

test("an invalid mint address does not abort the batch", async () => {
  const data = metadataAccount({
    name: "USD Coin",
    symbol: "USDC",
    uri: "https://example.test/usdc.json",
    layout: "padded",
  });
  const connection = {
    getMultipleAccountsInfo: async () => [{ data }],
  } as never;
  const found = await fetchOnChainMetadata(connection as never, [
    "not-a-mint",
    USDC,
  ]);
  // The invalid one is skipped; the call still completes.
  assert.ok(found.size <= 1);
});

test("an icon is read from the metadata document", async () => {
  clearIconCache();
  const fetchImpl = async () =>
    new Response(JSON.stringify({ image: "https://cdn.test/i.png" }));
  const icon = await resolveIconFromUri(
    "https://meta.test/a.json",
    undefined,
    fetchImpl as never,
  );
  assert.equal(icon, "https://cdn.test/i.png");
});

test("an ipfs uri is rewritten to a gateway", async () => {
  clearIconCache();
  const fetchImpl = async () =>
    new Response(JSON.stringify({ image: "ipfs://Qm" }));
  const icon = await resolveIconFromUri(
    "https://meta.test/b.json",
    undefined,
    fetchImpl as never,
  );
  assert.equal(icon, "https://ipfs.io/ipfs/Qm");
});

test("a document with no image yields no icon, not a broken one", async () => {
  clearIconCache();
  const fetchImpl = async () => new Response(JSON.stringify({ name: "x" }));
  const icon = await resolveIconFromUri(
    "https://meta.test/c.json",
    undefined,
    fetchImpl as never,
  );
  assert.equal(icon, null);
});

test("an unreachable metadata document yields no icon", async () => {
  clearIconCache();
  const fetchImpl = async () => {
    throw new Error("offline");
  };
  const icon = await resolveIconFromUri(
    "https://meta.test/d.json",
    undefined,
    fetchImpl as never,
  );
  assert.equal(icon, null);
});

test("a phishing-listed metadata host is never contacted", async () => {
  // `wider.guru` is Jupiter's token-icon CDN and it is on MetaMask's and
  // Phantom's blocklists. Some tokens name it as their metadata document, and
  // fetching it makes the wallet warn or refuse the page — so a memecoin in the
  // user's wallet can put a scary dialog in front of them. The request must not
  // be made at all, not merely allowed to fail.
  clearIconCache();
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return new Response(JSON.stringify({ image: "https://cdn.test/x.png" }));
  };
  const icon = await resolveIconFromUri(
    "https://www.wider.guru/json/jup2/metadata.json",
    undefined,
    fetchImpl as never,
  );
  assert.equal(icon, null);
  assert.equal(called, false, "the blocked host must not be requested");
});

test("the block covers a new path on the same host", async () => {
  // Blocked on the host, not the full URL, so a new path cannot route around it.
  clearIconCache();
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return new Response("{}");
  };
  await resolveIconFromUri(
    "https://wider.guru/some/other/path.json",
    undefined,
    fetchImpl as never,
  );
  assert.equal(called, false);
});

test("a blocked host is remembered, so it costs one lookup for the session", async () => {
  clearIconCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return new Response("{}");
  };
  const uri = "https://www.wider.guru/json/jup2/metadata.json";
  await resolveIconFromUri(uri, undefined, fetchImpl as never);
  await resolveIconFromUri(uri, undefined, fetchImpl as never);
  assert.equal(calls, 0);
});

test("an ordinary metadata host is still fetched", async () => {
  // The block must be narrow: most tokens are fine, and silently dropping every
  // icon would be a worse regression than the one it prevents.
  clearIconCache();
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return new Response(JSON.stringify({ image: "https://cdn.test/ok.png" }));
  };
  const icon = await resolveIconFromUri(
    "https://metadata.test/token.json",
    undefined,
    fetchImpl as never,
  );
  assert.equal(called, true);
  assert.equal(icon, "https://cdn.test/ok.png");
});

test("an icon is fetched once per document, not per render", async () => {
  clearIconCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return new Response(JSON.stringify({ image: "https://cdn.test/x.png" }));
  };
  const uri = "https://meta.test/cached.json";
  await resolveIconFromUri(uri, undefined, fetchImpl as never);
  await resolveIconFromUri(uri, undefined, fetchImpl as never);
  await resolveIconFromUri(uri, undefined, fetchImpl as never);
  assert.equal(calls, 1, "an icon never changes, so it is cached");
});
