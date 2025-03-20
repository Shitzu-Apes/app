<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import { addToast } from "../../Toast.svelte";

  import Button from "$lib/components/Button.svelte";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { refreshNearBalance, nearWallet } from "$lib/near";
  import { MemeCooking, updateMcAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import {
    awaitIndexerBlockHeight,
    awaitRpcBlockHeight,
  } from "$lib/store/indexer";
  import type { FixedNumber } from "$lib/util";

  export let accountId: string;
  export let meme: Meme;
  export let input: FixedNumber;
  export let unwrapNear: boolean;
  export let finished: boolean;
  export let hasEnoughTokens: boolean;
  export let depositAmount: FixedNumber;
  export let onTransact: () => void;
  export let disabled: boolean = false;

  async function withdraw() {
    const onSuccess = async (outcome: FinalExecutionOutcome[] | undefined) => {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Withdraw Success",
            description: `You have successfully withdrawn ${input.format()} NEAR`,
          },
        },
      });
      closeBottomSheet();

      if (!outcome) return;
      const blockHeight = await fetchBlockHeight(outcome);
      await Promise.all([
        awaitIndexerBlockHeight(blockHeight),
        awaitRpcBlockHeight(blockHeight),
      ]);
      refreshNearBalance(accountId);
      updateMcAccount(accountId);
    };

    onTransact();
    if (meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now()) {
      return MemeCooking.claim(
        nearWallet,
        {
          meme,
          unwrapNear,
          unwrapAmount: depositAmount.toU128() ?? "",
        },
        {
          onSuccess,
        },
      );
    } else {
      return MemeCooking.withdraw(
        nearWallet,
        {
          amount: input.toU128() ?? "",
          memeId: meme.meme_id,
          unwrapNear,
        },
        {
          onSuccess,
        },
      );
    }
  }
</script>

<Button
  onClick={async () => {
    await withdraw();
  }}
  type="custom"
  disabled={input == null ||
    input.toNumber() == 0 ||
    finished ||
    !hasEnoughTokens ||
    disabled}
  class="bg-rose-4 w-full py-2 rounded text-xl tracking-wider text-black border-rose-5 active:translate-y-1 my-4 capitalize"
>
  withdraw
</Button>
