<script lang="ts">
  import Chef from "../../Chef.svelte";
  import Countdown from "../../Countdown.svelte";

  import { goto } from "$app/navigation";
  import Near from "$lib/assets/Near.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let memebid: Meme;
  export let requiredStake: FixedNumber;

  $: reachedMcap = new FixedNumber(memebid.total_deposit, 24) >= requiredStake;
</script>

<div class="w-full">
  <a
    href={`/meme/${memebid.meme_id}`}
    class="w-full flex items-center justify-start gap-3 p-2 border border-transparent hover:border-white cursor-pointer relative"
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
      class="flex flex-col items-start justify-start h-full gap-1 flex-1 relative"
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
      <div class="text-xs flex items-center gap-1">
        created by <Chef account={memebid.owner} />
      </div>
      <div class="text-sm">
        {memebid.name}
        <span class="font-bold text-shitzu-4">{memebid.symbol}</span>
      </div>
      <div class="text-xs">{memebid.description}</div>

      <div class="flex flex-col gap-1">
        <span class="text-xs text-shitzu-4">
          {#if memebid.end_timestamp_ms}
            <Countdown
              class="text-xs text-shitzu-4"
              to={memebid.end_timestamp_ms}
            />
          {/if}
        </span>
        <span
          class="text-xs bg-amber text-black px-2 rounded self-start flex items-center"
        >
          <Near className="size-4 -ml-1" />
          {new FixedNumber(memebid.total_deposit, 24).format()}
        </span>
      </div>
    </div>
  </a>
</div>
