<script lang="ts">
  import type { MCAccountInfo } from "$lib/models/memecooking";
  import { Ft, MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let claim: MCAccountInfo["claims"][number];

  let tokenInfo = Ft.metadata(claim[0]);

  async function claiming() {
    const token = await tokenInfo;
    if (!token) return;
    try {
      await MemeCooking.claim(wallet, {
        token_ids: [claim[0]],
      });
    } catch (e) {
      console.error(e);
    }
  }
</script>

{#await tokenInfo}
  <div class="flex gap-4 items-center">
    <div class="loader size-24" />
    <div class="flex flex-col gap-2">
      <div class="loader w-40 h-4" />
      <div class="loader w-50 h-4" />
      <div class="loader w-20 h-2" />
      <div class="loader w-50 h-5" />
    </div>
  </div>
{:then memeInfo}
  {#if memeInfo}
    <div class="flex gap-4 items-center">
      <img
        src={memeInfo?.icon}
        alt="{memeInfo.name} icon"
        class="rounded-lg size-24"
      />
      <div class="flex flex-col">
        <div class="">
          <h3 class="text-lg font-bold uppercase">{memeInfo.symbol}</h3>
        </div>
        <div class="">
          <h4 class="text-md font-normal">{memeInfo.name}</h4>
        </div>
        <div class="">{new FixedNumber(claim[1], 24).format()}</div>
        <button class="" on:click={claiming}>[claim]</button>
      </div>
    </div>
  {/if}
{/await}
