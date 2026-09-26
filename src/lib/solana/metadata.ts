import { PublicKey, type Connection } from "@solana/web3.js";

/** Metaplex Token Metadata program. */
const METADATA_PROGRAM = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

export type OnChainMetadata = {
  name?: string;
  symbol?: string;
  /** Usually a JSON document on IPFS/arweave containing an `image`. */
  uri?: string;
};

/**
 * Tokens we ship assets for.
 *
 * These never depend on a third-party API, so the two the bridge is actually
 * about always render with a proper symbol and icon even when Jupiter is
 * rate-limiting or the token has no metadata account on chain.
 */
const KNOWN: Record<string, OnChainMetadata & { icon: string }> = {
  So11111111111111111111111111111111111111112: {
    symbol: "SOL",
    name: "Solana",
    icon: "/sol-logo.webp",
  },
  "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG": {
    symbol: "NEAR",
    name: "NEAR",
    icon: "/wnear.webp",
  },
};

export function knownMetadata(mint: string) {
  return KNOWN[mint];
}

export function knownIcon(mint: string): string | undefined {
  return KNOWN[mint]?.icon;
}

export function knownSymbol(mint: string): string | undefined {
  return KNOWN[mint]?.symbol;
}

function metadataPda(mint: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM.toBuffer(),
      new PublicKey(mint).toBuffer(),
    ],
    METADATA_PROGRAM,
  )[0];
}

/**
 * Issuers pad these fields, sometimes with nulls and sometimes with spaces, and
 * some pad the *length* too. Strip both and reject anything that decodes to
 * nothing usable.
 */
function clean(value: string): string | undefined {
  const out = value.replace(/\0/g, "").trim();
  if (!out) return undefined;
  // Control characters mean we mis-parsed the layout.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0e-\x1f]/.test(out)) return undefined;
  return out;
}

/**
 * Read the Metaplex account for a token.
 *
 * Handles both account layouts: the original fixed-width fields, and the newer
 * length-prefixed strings. A batched `getMultipleAccounts` covers a whole
 * wallet in one RPC round trip, which is why this is preferable to the token
 * list API — it cannot be rate-limited out from under us.
 */
function parseAccount(data: Buffer): OnChainMetadata | null {
  // key(1) + update_authority(32) + mint(32)
  const HEADER = 65;
  if (data.length < HEADER + 8) return null;
  // Only MetadataV1 (4) carries name/symbol/uri.
  if (data[0] !== 4) return null;

  const lengthPrefixed = data.readUInt32LE(HEADER);
  if (lengthPrefixed > 0 && lengthPrefixed < 1024) {
    const out: OnChainMetadata = {};
    let offset = HEADER;
    for (const field of ["name", "symbol", "uri"] as const) {
      if (offset + 4 > data.length) break;
      const length = data.readUInt32LE(offset);
      if (length > data.length) break;
      const value = clean(
        data.subarray(offset + 4, offset + 4 + length).toString("utf8"),
      );
      if (value) out[field] = value;
      offset += 4 + length;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  // Legacy fixed-width: name 32, symbol 10, uri 200.
  const name = clean(data.subarray(HEADER, HEADER + 32).toString("utf8"));
  const symbol = clean(
    data.subarray(HEADER + 32, HEADER + 42).toString("utf8"),
  );
  const uri = clean(data.subarray(HEADER + 42, HEADER + 242).toString("utf8"));
  const out: OnChainMetadata = {};
  if (name) out.name = name;
  if (symbol) out.symbol = symbol;
  if (uri) out.uri = uri;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * On-chain metadata for many mints in a single RPC call.
 *
 * Tokens with no metadata account are simply absent from the result, which is
 * normal and not an error.
 */
export async function fetchOnChainMetadata(
  connection: Connection,
  mints: string[],
  batchSize = 100,
): Promise<Map<string, OnChainMetadata>> {
  const found = new Map<string, OnChainMetadata>();
  const unique = [...new Set(mints)];

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    let pdas: PublicKey[];
    try {
      pdas = batch.map(metadataPda);
    } catch {
      continue; // an invalid mint address
    }

    try {
      const accounts = await connection.getMultipleAccountsInfo(pdas, "max");
      accounts.forEach((account, index) => {
        if (!account) return;
        const parsed = parseAccount(account.data);
        if (parsed) found.set(batch[index], parsed);
      });
    } catch {
      // Best effort: callers fall back to the token list API.
    }
  }

  return found;
}

const iconCache = new Map<string, string | null>();

/**
 * Resolve an icon URL from a metadata document.
 *
 * Kept separate from the metadata read because it is an extra HTTP request per
 * token, and results are cached: a token's icon does not change.
 */
export async function resolveIconFromUri(
  uri: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const cached = iconCache.get(uri);
  if (cached !== undefined) return cached;

  let icon: string | null = null;
  try {
    const res = await fetchImpl(uri, { signal });
    if (res.ok) {
      const doc = (await res.json()) as { image?: string; icon?: string };
      const candidate = doc.image ?? doc.icon;
      if (typeof candidate === "string" && candidate) {
        icon = candidate.startsWith("ipfs://")
          ? `https://ipfs.io/ipfs/${candidate.slice(7)}`
          : candidate;
      }
    }
  } catch {
    icon = null;
  }

  iconCache.set(uri, icon);
  return icon;
}

/** Test seam. */
export function clearIconCache(): void {
  iconCache.clear();
}
