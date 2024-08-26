import type { Meme } from "$lib/models/memecooking";

export function sortMemeByEndtimestamp(a: Meme, b: Meme) {
  if (a.end_timestamp_ms != null && b.end_timestamp_ms == null) {
    return -1;
  }
  if (a.end_timestamp_ms == null && b.end_timestamp_ms != null) {
    return 1;
  }

  return a.end_timestamp_ms! - b.end_timestamp_ms!;
}

type MemeWithUnclaimed = {
  unclaimed: boolean;
  end_timestamp_ms: number;
};

export function sortMemeByUnclaimedThenEndTimestamp(
  a: MemeWithUnclaimed,
  b: MemeWithUnclaimed,
) {
  if (a.unclaimed && !b.unclaimed) {
    return -1;
  }
  if (!a.unclaimed && b.unclaimed) {
    return 1;
  }

  if (a.unclaimed && b.unclaimed) {
    return b.end_timestamp_ms - a.end_timestamp_ms;
  }

  return b.end_timestamp_ms - a.end_timestamp_ms;
}
