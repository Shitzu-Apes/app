<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import type { ExecutionStatus } from "near-api-js/lib/providers/provider";

  export let txPromise: Promise<
    void | FinalExecutionOutcome | FinalExecutionOutcome[]
  >;
  export let setClass: (className: string) => void;

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
      setClass("snackbar-error");
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
    const outcomeStatus = outcome.transaction_outcome.outcome
      .status as ExecutionStatus;
    let status: "success" | "error" = "success";
    let errorMessage;
    if (outcomeStatus.SuccessValue || outcomeStatus.SuccessReceiptId) {
      setClass("snackbar-success");
    } else {
      status = "error";
      setClass("snackbar-error");
    }

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
        setClass("snackbar-error");
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

<div
  class="flex flex-col justify-between [&>*]:flex [&>*]:items-center [&>*]:p-3 [&>*]:gap-2 bg-gradient-to-r bg-gradient-from-cyan bg-gradient-to-blue text-gray-8 font-size-[1.1rem] font-bold"
>
  {#await outcome}
    <div>
      <div class="i-svg-spinners:6-dots-rotate w-6 h-6 bg-gray-8" />
      <div>Awaiting confirmation</div>
    </div>
  {:then res}
    {#if res == null}
      <div>
        <div class="i-line-md:confirm w-6 h-6 bg-gray-8" />
        <div>Complete</div>
      </div>
    {:else if Array.isArray(res)}
      {#each res as { status, id, functionCalls, tokensBurnt, receiptError }}
        <div class="tx-status">
          {#if status === "success"}
            <div class="w-6 h-6 text-green-8 i-mdi-check-circle" />
          {:else}
            <div class="w-6 h-6 text-red-8 i-mdi-cancel" />
          {/if}
          <div>
            <div>
              Called method{functionCalls.length > 1 ? "s" : ""}: {functionCalls.join(
                ", ",
              )}
            </div>
            <div>
              Total gas burnt: {tokensBurnt.format({
                maximumFractionDigits: 1,
                maximumSignificantDigits: 4,
              })} TGas ({tokensBurnt.mul(new FixedNumber("1", 4)).format({
                maximumFractionDigits: 5,
                maximumSignificantDigits: 4,
              })}N)
            </div>
            <div>
              <a
                class="text-gray-9 visited:text-gray-9"
                href="{import.meta.env.VITE_EXPLORER_URL}/transactions/{id}"
                target="_blank"
                rel="noopener"
              >
                Link to transaction
                <button class="rounded-xl p-2">
                  <div class="w-4 h-4 i-mdi-open-in-new" />
                </button>
              </a>
            </div>
            {#if receiptError}
              <div>
                <div>An error occured in a receipt:</div>
                <div>{receiptError}</div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {:else if res.status === "error"}
      <div>
        <div class="w-6 h-6 text-red-8 i-mdi-cancel" />
        <div>
          <div>An error occured:</div>
          <div>{res.message}</div>
        </div>
      </div>
    {/if}
  {/await}
</div>
