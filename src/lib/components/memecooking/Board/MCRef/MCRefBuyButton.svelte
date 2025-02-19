<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { derived } from "svelte/store";

  import { addToast } from "../../../Toast.svelte";

  import { useFtBalanceQuery } from "$lib/api/queries";
  import { Button } from "$lib/components";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import {
    nearBalance,
    refreshNearBalance,
    type TransactionCallbacks,
  } from "$lib/near";
  import { updateMcAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { handleBuy } from "$lib/near/swap";
  import {
    awaitIndexerBlockHeight,
    awaitRpcBlockHeight,
  } from "$lib/store/indexer";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";

  export let accountId: string;
  export let input: FixedNumber;
  export let meme: Meme;

  let slippage: number = 0.05; // Default 5% slippage

  const tokenBalanceQuery = useFtBalanceQuery(
    getTokenId(meme),
    accountId,
    meme.decimals,
  );
  const wrapNearBalanceQuery = useFtBalanceQuery(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
    accountId,
    24,
  );

  let expectedValue:
    | {
        amount: FixedNumber;
        priceImpact: number;
        shitzuBuy?: {
          amount: FixedNumber;
          nearAmount: FixedNumber;
        };
      }
    | undefined;

  let totalNearBalance$ = derived(
    [nearBalance, wrapNearBalanceQuery],
    ([nearBalance, wrapNearBalance]) =>
      nearBalance?.add(wrapNearBalance.data ?? new FixedNumber("0", 24)) ??
      new FixedNumber("0", 24),
  );

  async function action() {
    if (expectedValue == null) return;

    const callback: TransactionCallbacks<FinalExecutionOutcome[]> = {
      onSuccess: async (outcome) => {
        if (!outcome || !accountId) return;

        const refReceipt = outcome[outcome.length - 1].receipts_outcome.find(
          (outcome) =>
            outcome.outcome.executor_id ===
            import.meta.env.VITE_REF_CONTRACT_ID,
        );
        if (refReceipt != null) {
          const log = refReceipt.outcome.logs[0];
          const inAmount = new FixedNumber(
            log.split("Swapped ")[1].split(" ")[0],
            24,
          );
          const outAmount = new FixedNumber(
            log.split(" for ")[1].split(" ")[0],
            24,
          );
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Swap Success",
                description: `You successfully swapped ${inAmount.format({
                  compactDisplay: "short",
                  notation: "compact",
                })} NEAR for ${outAmount.format({
                  compactDisplay: "short",
                  notation: "compact",
                  maximumFractionDigits: 3,
                })} ${meme.symbol}`,
              },
            },
            closeDelay: 8_000,
          });
        }
        closeBottomSheet();

        const blockHeight = await fetchBlockHeight(outcome);
        await Promise.all([
          awaitIndexerBlockHeight(blockHeight),
          awaitRpcBlockHeight(blockHeight),
        ]);
        refreshNearBalance(accountId);
        $tokenBalanceQuery.refetch();
        updateMcAccount(accountId);
      },
    };
    return handleBuy(
      input,
      accountId,
      expectedValue.amount,
      meme,
      slippage,
      callback,
    );
  }
</script>

<Button
  onClick={action}
  type="custom"
  disabled={input == null ||
    input.toNumber() == 0 ||
    $totalNearBalance$.toBigInt() < input.toBigInt()}
  class="bg-shitzu-4 w-full py-2 rounded text-xl tracking-wider text-black border-shitzu-5 active:translate-y-1 my-4"
>
  Buy {meme.symbol}
</Button>
