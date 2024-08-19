<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import Chef from "../../Chef.svelte";
  import Countdown from "../../Countdown.svelte";

  import { goto } from "$app/navigation";
  import Near from "$lib/assets/Near.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";
  import { projectedMCap } from "$lib/util/projectedMCap";

  export let memebid: Meme;
  export let requiredStake: FixedNumber;
  export let showCook = true;
  export let depositAmount: string | undefined = undefined;
  export let claimAmount: string | undefined = undefined;
  export let update:
    | ((
        outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
      ) => void)
    | undefined = undefined;

  $: reachedMcap = new FixedNumber(memebid.total_deposit, 24) >= requiredStake;

  $: mcap = projectedMCap(memebid);

  async function withdraw(ev: Event) {
    ev.preventDefault();
    if (memebid.end_timestamp_ms == null || depositAmount == null) return;
    try {
      if (memebid.end_timestamp_ms < Date.now()) {
        await MemeCooking.claim(
          wallet,
          {
            meme_ids: [memebid.meme_id],
            token_ids: [],
          },
          {
            onSuccess: update,
          },
        );
      } else {
        await MemeCooking.withdraw(
          wallet,
          {
            memeId: memebid.meme_id,
            amount: depositAmount,
          },
          {
            onSuccess: update,
          },
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function claim(ev: Event) {
    ev.preventDefault();
    try {
      await MemeCooking.claim(
        wallet,
        {
          meme_ids: [memebid.meme_id],
          token_ids: [getTokenId(memebid.symbol, memebid.meme_id)],
        },
        {
          onSuccess: update,
        },
      );
    } catch (e) {
      console.error(e);
    }
  }
</script>

<div class="w-full">
  <a
    href={`/meme/${memebid.meme_id}`}
    class="w-full grid grid-cols-[auto_1fr] items-center justify-start gap-3 p-2 border border-transparent hover:border-white cursor-pointer relative"
  >
    <div class="w-24 flex flex-col items-center">
      <img
        src={`${import.meta.env.VITE_IPFS_GATEWAY}/${memebid.image}`}
        alt={memebid.name}
        class="max-h-24"
      />
      {#if memebid && memebid.end_timestamp_ms && !memebid.pool_id && memebid.end_timestamp_ms < Date.now()}
        <button
          class="border-2 border-memecooking-2 font-mono text-memecooking-2 hover:bg-memecooking-2 hover:text-black flex items-center gap-1 w-24 px-1"
          on:click={(e) => {
            e.preventDefault();
            goto(`/create`);

            localStorage.setItem("meme_to_cto", JSON.stringify(memebid));
          }}
        >
          <div class="i-mdi:alert" />
          <span class="text-xs"> Relaunch </span>
        </button>
      {/if}
    </div>
    <div
      class="flex flex-col items-start justify-start h-full gap-1 flex-1 relative overflow-hidden"
    >
      {#if memebid.pool_id}
        <a
          href={`https://testnet.ref.finance/pool/${memebid.pool_id}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs self-end px-1 tracking-tight bg-shitzu-3 rounded-full text-black flex items-center gap-1"
        >
          live on ref <div class="i-mdi:open-in-new" />
        </a>
      {:else if memebid.end_timestamp_ms && memebid.end_timestamp_ms < Date.now()}
        {#if reachedMcap}
          <div
            class="text-xs self-end px-1 tracking-tight bg-amber-4 rounded-full text-black"
          >
            pending launch
          </div>
        {:else}
          <div
            class="text-xs self-end px-1 tracking-tight bg-rose-4 rounded-full text-black"
          >
            didn&apos;t make it
          </div>
        {/if}
      {/if}
      {#if showCook}
        <div class="text-xs flex items-center gap-1 w-full">
          created by <Chef
            account={memebid.owner}
            class="flex-1 w-0 overflow-hidden text-ellipsis"
          />
        </div>
      {/if}
      <div class="text-sm">
        {memebid.name}
        <span class="font-semibold text-shitzu-4">${memebid.symbol}</span>
      </div>
      <div class="text-xs line-clamp-12">{memebid.description}</div>

      <div class="w-full flex justify-center">
        <span class="text-xs text-shitzu-4">
          {#if memebid.end_timestamp_ms}
            <Countdown
              class="text-xs text-shitzu-4"
              to={memebid.end_timestamp_ms}
            />
          {/if}
        </span>
      </div>
      <div class="w-full flex justify-between items-center self-stretch">
        <span class="text-xs text-shitzu-2 px-2 flex items-center">
          MCap: ${$mcap.format({
            maximumFractionDigits: 2,
            maximumSignificantDigits: 2,
          })}
        </span>

        <div>
          <div class="flex items-center gap-3 text-shitzu-2">
            {#if typeof memebid.staker_count === "number"}
              <div class="text-sm flex items-center gap-1">
                <div class="i-mdi:account-multiple size-5" />
                <span class="font-bold">
                  {memebid.staker_count}
                </span>
              </div>
            {/if}
            {#if typeof memebid.replies_count === "number"}
              <div class="text-sm flex items-center gap-1">
                <div class="i-mdi:chat size-5" />
                <span class="font-bold">
                  {memebid.replies_count}
                </span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="grid-col-start-2 ml-auto flex flex-col justify-end items-end">
      {#if depositAmount != null}
        <button class="hover:underline flex items-center" on:click={withdraw}>
          [withdraw {new FixedNumber(depositAmount, 24).format({
            compactDisplay: "short",
            notation: "compact",
          })}
          <Near className="size-4 inline" />]
        </button>
      {/if}
      {#if claimAmount != null}
        <button class="hover:underline" on:click={claim}>
          [claim {new FixedNumber(claimAmount, memebid.decimals).format({
            compactDisplay: "short",
            notation: "compact",
          })}
          {#if memebid.image}
            <img
              src="{import.meta.env.VITE_IPFS_GATEWAY}/{memebid.image}"
              alt="icon"
              class="size-4 inline"
            />
          {:else}
            <div class="size-4 bg-gray-200 inline"></div>
          {/if}]
        </button>
      {/if}
    </div>
  </a>
</div>
