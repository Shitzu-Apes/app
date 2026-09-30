import { get, writable, type Readable } from "svelte/store";

import { Ref, type PoolInfo } from "$lib/near";

/**
 * Shared cache of Ref pool info, keyed by pool id.
 *
 * The board only ever needs the pools referenced by the memes it shows (a few
 * hundred), so instead of enumerating all ~9k pools with `get_pools` we load
 * the ids we actually read from with `get_pool_by_ids`.
 */
const pools = writable<Map<number, PoolInfo>>(new Map());

export const poolsById$: Readable<Map<number, PoolInfo>> = {
  subscribe: pools.subscribe,
};

/** Max pool ids per `get_pool_by_ids` call. */
const CHUNK_SIZE = 200;
/** Max concurrent RPC calls. */
const MAX_CONCURRENT = 3;

const requested = new Set<number>();
const failed = new Set<number>();
const pending: number[] = [];
let inFlight = 0;
let scheduled = false;

export function getPoolInfo(
  poolId: number | null | undefined,
): PoolInfo | undefined {
  if (poolId == null) return undefined;
  return get(pools).get(poolId);
}

/**
 * Queue the given pool ids for loading. Idempotent: ids that are already
 * loaded, in flight, or known to be invalid are skipped.
 */
export function ensurePoolsLoaded(
  poolIds: Array<number | null | undefined>,
): void {
  let added = false;
  for (const id of poolIds) {
    if (id == null || !Number.isInteger(id)) continue;
    if (requested.has(id) || failed.has(id)) continue;
    requested.add(id);
    pending.push(id);
    added = true;
  }
  if (added) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flush);
}

function flush() {
  scheduled = false;
  while (inFlight < MAX_CONCURRENT && pending.length > 0) {
    const batch = pending.splice(0, CHUNK_SIZE);
    inFlight += 1;
    void loadBatch(batch).finally(() => {
      inFlight -= 1;
      if (pending.length > 0) schedule();
    });
  }
}

async function loadBatch(ids: number[]): Promise<void> {
  try {
    const loaded = await Ref.getPoolByIds(ids);
    if (loaded && loaded.length === ids.length) {
      storePools(ids, loaded);
      return;
    }
    storePools(ids, loaded ?? []);
    // Anything the contract did not return is not a valid pool id.
    ids.slice(loaded?.length ?? 0).forEach((id) => failed.add(id));
  } catch (error) {
    // The contract panics on the whole call when one id is invalid, so split
    // the batch until the bad id is isolated instead of losing the batch.
    if (ids.length > 1) {
      const mid = Math.floor(ids.length / 2);
      await loadBatch(ids.slice(0, mid));
      await loadBatch(ids.slice(mid));
      return;
    }
    failed.add(ids[0]);
    console.warn("[pools] could not load pool", ids[0], error);
  }
}

function storePools(ids: number[], loaded: PoolInfo[]) {
  if (loaded.length === 0) return;
  pools.update((map) => {
    const next = new Map(map);
    loaded.forEach((pool, index) => {
      if (ids[index] != null) next.set(ids[index], pool);
    });
    return next;
  });
}
