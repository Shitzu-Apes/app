<script lang="ts">
  import type {
    Action,
    FinalExecutionOutcome,
  } from "@near-wallet-selector/core";
  import { writable } from "svelte/store";

  import { addToast } from "../../Toast.svelte";
  import TokenInput from "../../TokenInput.svelte";

  import { Button } from "$lib/components";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { Ft, nearWallet, type TransactionCallbacks } from "$lib/near";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";

  export let meme: Meme;

  const { accountId$ } = nearWallet;

  let input: TokenInput;
  $: input$ = input?.u128$;
  let inputValue$ = writable<string | undefined>();
  let recipientId = "";

  const tokenBalance = writable<FixedNumber | undefined>();
  $: if ($accountId$) {
    refreshTokenBalance($accountId$);
  }

  function refreshTokenBalance(accountId: string) {
    Ft.balanceOf(getTokenId(meme), accountId, meme.decimals).then((balance) => {
      $tokenBalance = balance;
    });
  }

  function setMax() {
    if (!$tokenBalance) return;
    $inputValue$ = $tokenBalance.toString();
  }

  async function handleSend() {
    if (!$accountId$ || !$input$ || !recipientId) return;

    const tokenId = getTokenId(meme);
    const isRegistered = await Ft.isUserRegistered(tokenId, recipientId);

    const actions: Action[] = [];
    if (!isRegistered) {
      const deposit = await Ft.storageRequirement(tokenId);
      actions.push({
        type: "FunctionCall",
        params: {
          methodName: "storage_deposit",
          args: {
            account_id: recipientId,
            registration_only: true,
          },
          gas: 20_000_000_000_000n.toString(),
          deposit,
        },
      });
    }

    const callback: TransactionCallbacks<FinalExecutionOutcome[]> = {
      onSuccess: async (outcome) => {
        if (!outcome || !$accountId$) return;

        addToast({
          data: {
            type: "simple",
            data: {
              title: "Transfer Success",
              description: `Successfully sent ${$input$.format()} ${meme.symbol} to ${recipientId}`,
            },
          },
        });

        closeBottomSheet();
        $inputValue$ = "";
        refreshTokenBalance($accountId$);
      },
    };
    actions.push({
      type: "FunctionCall",
      params: {
        methodName: "ft_transfer",
        args: {
          receiver_id: recipientId,
          amount: $input$.toU128(),
        },
        gas: "30000000000000",
        deposit: "1",
      },
    });
    try {
      await nearWallet.signAndSendTransactions(
        {
          transactions: [
            {
              receiverId: tokenId,
              actions,
            },
          ],
        },
        callback,
      );
    } catch (e) {
      console.error(e);
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description: "Failed to send tokens",
            type: "error",
          },
        },
      });
    }
  }
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Send {meme.symbol}
    </h2>
  </slot>

  <section class="text-white px-3 space-y-4 my-10">
    <div class="relative w-full">
      <div class="absolute inset-y-0 left-0 flex items-center pl-2">
        <McIcon {meme} class="w-6 h-6 rounded-full" />
      </div>
      <TokenInput
        class="bg-transparent rounded-xl w-full py-6 text-center text-2xl px-14 appearance-none outline-none text-shitzu-4"
        decimals={meme.decimals}
        bind:this={input}
        bind:value={$inputValue$}
      />
      <div
        class="absolute inset-y-0 right-0 flex flex-col justify-center items-center pr-2 text-xs gap-1"
      >
        <div class="flex-grow basis-0" />
        <button
          class="text-sm cursor-pointer bg-gray-3 px-2 rounded-full border border-gray-6 text-shitzu-7"
          on:click={setMax}
        >
          <div class="">Max</div>
        </button>
        <div class="text-shitzu-4 flex-grow basis-0">
          {#if $tokenBalance != null}
            {$tokenBalance.format()}
          {:else}
            -
          {/if}
        </div>
      </div>
    </div>

    <div class="w-full">
      <label
        for="recipientId"
        class="block text-sm font-medium text-gray-400 mb-2"
      >
        Recipient Account ID
      </label>
      <input
        type="text"
        bind:value={recipientId}
        class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-shitzu-4"
        placeholder="account.near"
      />
    </div>
  </section>

  <Button
    onClick={handleSend}
    type="custom"
    disabled={$input$ == null || $input$.toNumber() == 0 || !recipientId}
    class="w-full bg-shitzu-4 py-2 rounded text-xl tracking-wider text-black border-shitzu-5 active:translate-y-1"
  >
    Send {meme.symbol}
  </Button>
</BottomSheetContent>
