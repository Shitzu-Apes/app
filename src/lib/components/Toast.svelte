<script lang="ts" context="module">
  export type ToastType =
    | {
        type: "simple";
        data: {
          title: string;
          description: string;
          color?: string;
        };
      }
    | {
        type: "tx";
        canClose: boolean;
        props: {
          txPromise:
            | Promise<FinalExecutionOutcome>
            | Promise<void | FinalExecutionOutcome | FinalExecutionOutcome[]>;
        };
        success?: boolean;
      };

  const {
    elements: { content, title, description, close },
    helpers,
    states: { toasts },
    actions: { portal },
  } = createToaster<ToastType>();

  export const addToast = helpers.addToast;

  export function addTxToast(
    txPromise:
      | Promise<void | FinalExecutionOutcome | FinalExecutionOutcome[]>
      | Promise<FinalExecutionOutcome>,
  ) {
    const toast = helpers.addToast({
      data: {
        type: "tx",
        canClose: false,
        props: {
          txPromise,
        },
      },
      closeDelay: 0,
    });
    txPromise
      .then((outcome) => {
        if (!(outcome instanceof Object)) return;
        let success = true;
        if (Array.isArray(outcome)) {
          if (outcome.find((o) => !isOutcomeSuccess(o))) {
            success = false;
          }
        } else {
          success = isOutcomeSuccess(outcome);
        }
        helpers.updateToast(toast.id, {
          type: "tx",
          canClose: true,
          props: { txPromise },
          success,
        });
      })
      .catch(() => {
        helpers.updateToast(toast.id, {
          type: "tx",
          canClose: true,
          props: { txPromise },
          success: false,
        });
      })
      .finally(() => {
        setTimeout(() => {
          try {
            helpers.removeToast(toast.id);
          } catch (err) {
            // already removed
          }
        }, 8_000);
      });
  }

  function isOutcomeSuccess(outcome: FinalExecutionOutcome): boolean {
    const outcomeStatus = outcome.transaction_outcome.outcome
      .status as ExecutionStatus;
    if (!outcomeStatus.SuccessValue && !outcomeStatus.SuccessReceiptId) {
      return false;
    }

    for (const receiptsOutcome of outcome.receipts_outcome) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receiptStatus = receiptsOutcome.outcome.status as any;
      if (receiptStatus.Failure) {
        return false;
      }
    }
    return true;
  }
</script>

<script lang="ts">
  import { createToaster, melt } from "@melt-ui/svelte";
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import type { ExecutionStatus } from "near-api-js/lib/providers/provider";
  import { fly, slide } from "svelte/transition";

  import TxSnackbar from "./TxSnackbar.svelte";
</script>

<div
  use:portal
  class="fixed right-0 top-0 z-50 m-4 flex flex-col items-end gap-2 md:bottom-0 md:top-auto"
>
  {#each $toasts as { id, data } (id)}
    <div
      use:melt={$content(id)}
      in:fly={{ x: "50%", duration: 500 }}
      out:slide
      class="relative rounded-lg bg-neutral-800 text-white border border-red-200"
    >
      <div
        class="relative flex w-[24rem] max-w-[calc(100vw-2rem)] items-center justify-between gap-4 p-5 pt-6"
      >
        {#if data.type === "simple"}
          <div>
            <h3
              use:melt={$title(id)}
              class="flex items-center gap-2 font-semibold"
            >
              {data.data.title}
              <span class="size-1.5 rounded-full {data.data.color}" />
            </h3>
            <div use:melt={$description(id)}>
              {data.data.description}
            </div>
          </div>
        {:else if data.type === "tx"}
          <TxSnackbar {...data.props} />
        {/if}
        {#if data.type === "simple" || data.canClose}
          <button
            use:melt={$close(id)}
            class="absolute right-4 top-4 grid size-6 place-items-center rounded-full text-magnum-500
      hover:bg-magnum-900/50 red"
          >
            <div class="i-mdi:close size-4" />
          </button>
        {/if}
      </div>
    </div>
  {/each}
</div>
