<script lang="ts">
  import type { MCAccountInfo } from "$lib/models/memecooking";
  import { MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let deposit: MCAccountInfo["deposits"][number];

  let memeInfo = MemeCooking.getMeme(deposit[0]);

  async function withdraw() {
    const meme = await memeInfo;
    if (!meme) return;
    try {
      await MemeCooking.withdraw(wallet, {
        memeId: meme.id,
        amount: deposit[1],
      });
    } catch (e) {
      console.error(e);
    }
  }
</script>

{#await memeInfo}
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
        <div class="">{new FixedNumber(deposit[1], 24).format()}</div>
        <button class="" on:click={withdraw}>[withdraw]</button>
      </div>
    </div>
  {/if}
{/await}
