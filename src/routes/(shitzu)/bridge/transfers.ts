import { type Chain, type Transfer } from "omni-bridge-sdk";
import { writable } from "svelte/store";

function getTransferKey(transfer: Transfer): string {
  return `${transfer.id?.origin_chain}:${transfer.id?.origin_nonce}`;
}

function sortTransfers(transfers: Transfer[]): Transfer[] {
  return transfers.sort((a, b) => {
    const aTime =
      a.initialized?.NearReceipt?.block_timestamp_seconds ??
      a.initialized?.EVMLog?.block_timestamp_seconds ??
      a.initialized?.Solana?.block_timestamp_seconds ??
      0;
    const bTime =
      b.initialized?.NearReceipt?.block_timestamp_seconds ??
      b.initialized?.EVMLog?.block_timestamp_seconds ??
      b.initialized?.Solana?.block_timestamp_seconds ??
      0;
    return bTime - aTime;
  });
}

const { subscribe, update, set } = writable<Transfer[]>([]);

export const transfers = {
  subscribe,
  addTransfers: (newTransfers: Transfer[]) => {
    update((existingTransfers) => {
      // Create a map of existing transfers using the unique key
      const existingKeys = new Set(existingTransfers.map(getTransferKey));

      // Filter out duplicates from new transfers
      const uniqueNewTransfers = newTransfers.filter(
        (transfer) => !existingKeys.has(getTransferKey(transfer)),
      );

      // Combine and sort
      const combined = [...uniqueNewTransfers, ...existingTransfers];
      return sortTransfers(combined);
    });
  },
  removeTransfersByChain: (chain: Chain) => {
    update((transfers) =>
      transfers.filter((t) => t.id?.origin_chain !== chain),
    );
  },
  updateTransfer: (transfer: { event: Transfer; chain: Chain }) => {
    update((transfers) =>
      sortTransfers(
        transfers.map((t) =>
          t.id?.origin_chain === transfer.event.id?.origin_chain &&
          t.id?.origin_nonce === transfer.event.id?.origin_nonce
            ? transfer.event
            : t,
        ),
      ),
    );
  },
  clear: () => set([]),
};
