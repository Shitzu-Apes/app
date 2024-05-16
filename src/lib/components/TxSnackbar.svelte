<script lang="ts">
  import { mdiOpenInNew, mdiCheck, mdiCancel, mdiCheckCircle } from "@mdi/js";
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import IconButton, { Icon } from "@smui/icon-button";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import type { ExecutionStatus } from "near-api-js/lib/providers/provider";

  import { ProgressSpinner } from ".";

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

<div class="tx-snackbar">
  {#await outcome}
    <div>
      Awaiting confirmation
      <ProgressSpinner width={48} height={48} borderWidth={6} inline />
    </div>
  {:then res}
    {#if res == null}
      Complete
      <IconButton size="button" class="material-icons">
        <Icon tag="svg" viewBox="0 0 24 24">
          <path fill="currentColor" d={mdiCheck} />
        </Icon>
      </IconButton>
    {:else if Array.isArray(res)}
      {#each res as { status, id, functionCalls, tokensBurnt, receiptError }}
        <div class="tx-status">
          {#if status === "success"}
            <div class="icon">
              <Icon tag="svg" viewBox="0 0 24 24">
                <path fill="var(--color-ok)" d={mdiCheckCircle} />
              </Icon>
            </div>
          {:else}
            <div class="icon">
              <Icon tag="svg" viewBox="0 0 24 24">
                <path fill="var(--color-err)" d={mdiCancel} />
              </Icon>
            </div>
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
                href="{import.meta.env.VITE_EXPLORER_URL}/txns/{id}"
                target="_blank"
                rel="noopener"
              >
                Link to transaction
                <IconButton size="button" class="material-icons">
                  <Icon tag="svg" viewBox="0 0 24 24">
                    <path fill="currentColor" d={mdiOpenInNew} />
                  </Icon>
                </IconButton>
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
      <div class="tx-status">
        <div class="icon">
          <Icon tag="svg" viewBox="0 0 24 24">
            <path fill="var(--err-color)" d={mdiCancel} />
          </Icon>
        </div>
        <div>
          <div>An error occured:</div>
          <div>{res.message}</div>
        </div>
      </div>
    {/if}
  {/await}
</div>

<style lang="scss">
  .tx-snackbar {
    display: flex;
    flex-direction: column;
    font-size: 1rem;

    > * {
      display: flex;
      align-items: center;
    }
  }

  .tx-status {
    display: flex;
    align-items: center;
  }

  .icon {
    min-width: to-rem(28px);
    max-width: to-rem(28px);
    min-height: to-rem(28px);
    max-height: to-rem(28px);
    padding: to-rem(4px);
    margin-right: 0.4rem;
  }

  a {
    display: inline-flex;
    align-items: center;
    color: var(--color-link);
  }
</style>
