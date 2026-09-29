<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import { FixedNumber } from "$lib/util";

  export let txPromise: Promise<
    void | FinalExecutionOutcome | FinalExecutionOutcome[]
  >;

  const TGAS_DECIMALS = 12;

  type TxOutcome = {
    status: "success" | "error";
    id: string;
    tokensBurnt: FixedNumber;
    functionCalls: string[];
    receiptError?: string;
  };

  const outcome: Promise<
    undefined | TxOutcome[] | { status: "error"; message: string }
  > = txPromise
    .then((outcome) => {
      if (!(outcome instanceof Object)) return;
      if (Array.isArray(outcome)) {
        return outcome.map(mapOutcome);
      }
      return [mapOutcome(outcome)];
    })
    .catch((err) => {
      if (err instanceof Error) {
        return {
          status: "error" as const,
          message: err.message,
        };
      } else {
        throw err;
      }
    });

  function mapOutcome(outcome: FinalExecutionOutcome): TxOutcome {
    let status: "success" | "error" = "success";
    let errorMessage;

    let tokensBurnt = new FixedNumber(
      String(outcome.transaction_outcome.outcome.gas_burnt),
      TGAS_DECIMALS,
    );
    for (const receiptsOutcome of outcome.receipts_outcome) {
      tokensBurnt = tokensBurnt.add(
        new FixedNumber(
          String(receiptsOutcome.outcome.gas_burnt),
          TGAS_DECIMALS,
        ),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receiptStatus = receiptsOutcome.outcome.status as any;
      if (receiptStatus.Failure) {
        status = "error";
        errorMessage =
          receiptStatus.Failure.ActionError?.kind?.FunctionCallError
            ?.ExecutionError;
      }
    }

    const functionCalls: string[] = [];
    if (Array.isArray(outcome.transaction.actions)) {
      for (const action of outcome.transaction.actions) {
        if (action.FunctionCall != null) {
          functionCalls.push(action.FunctionCall.method_name);
        }
      }
    }

    return {
      status,
      id: outcome.transaction_outcome.id,
      tokensBurnt,
      functionCalls,
      receiptError: errorMessage,
    };
  }
</script>

<div class="flex flex-col gap-2">
  {#await outcome}
    <div class="flex items-center gap-2">
      <div class="i-svg-spinners:90-ring size-5" />
      <div class="text-sm text-gray-300">Awaiting confirmation</div>
    </div>
  {:then res}
    {#if res == null}
      <div class="flex items-center gap-2">
        <div class="i-line-md:confirm size-5 text-gray-400" />
        <div class="text-sm text-gray-300">Complete</div>
      </div>
    {:else if Array.isArray(res)}
      {#each res as { status, id, functionCalls, tokensBurnt, receiptError }}
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            {#if status === "success"}
              <div class="size-5 text-green-500 i-mdi-check-circle" />
            {:else}
              <div class="size-5 text-red-500 i-mdi-cancel" />
            {/if}
            <div class="text-sm text-gray-300">
              Called method{functionCalls.length > 1 ? "s" : ""}: {functionCalls.join(
                ", ",
              )}
            </div>
          </div>

          <div class="text-sm text-gray-300 pl-7">
            Total gas burnt: {tokensBurnt.format({
              maximumFractionDigits: 1,
              maximumSignificantDigits: 4,
            })} TGas ({tokensBurnt.mul(new FixedNumber("1", 4)).format({
              maximumFractionDigits: 5,
              maximumSignificantDigits: 4,
            })}N)
          </div>

          <div class="pl-7">
            <a
              class="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              href="{import.meta.env.VITE_EXPLORER_URL}/transactions/{id}"
              target="_blank"
              rel="noopener"
            >
              Link to transaction
              <div class="size-4 i-mdi-open-in-new" />
            </a>
          </div>

          {#if receiptError}
            <div class="text-sm text-red-400 pl-7">
              <div>An error occurred in a receipt:</div>
              <div class="text-gray-300">{receiptError}</div>
            </div>
          {/if}
        </div>
      {/each}
    {:else if res.status === "error"}
      <div class="flex items-center gap-2">
        <div class="size-5 text-red-500 i-line-md:cancel" />
        <div class="text-sm">
          <div class="text-red-400">An error occurred:</div>
          <div class="text-gray-300">{res.message}</div>
        </div>
      </div>
    {/if}
  {/await}
</div>
