<script lang="ts">
  import { page } from "$app/stores";
  import Near from "$lib/assets/Near.svelte";
  import TradeTabs from "$lib/components/memecooking/Board/Desktop/TradeTabs.svelte";
  import MCStake from "$lib/components/memecooking/Board/MCStake.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import { MemeCooking } from "$lib/near";

  // page data
  let { meme_id } = $page.params;

  let meme = MemeCooking.getMemeWithReference(+meme_id);
</script>

<div class="mt-10 w-full p-2">
  <div class="mx-auto flex">
    <a href="/board" class="text-white text-2xl mx-auto mb-10">[go back]</a>
  </div>
  {#await meme}
    <div>Loading...</div>
  {:then meme}
    {#if meme}
      <div class="w-full flex">
        <Countdown
          class="mx-auto text-4xl text-shitzu-4 mb-10"
          to={meme.end_timestamp_ms}
        />
      </div>
      <div class="flex px-2 gap-2">
        <div class="flex-grow">
          <div class="w-full flex items-center gap-3 my-2 text-sm">
            <span>
              {meme.name}
            </span>
            <span class="uppercase">
              {meme.symbol}
            </span>
            <span class="text-green-400 flex items-center">
              Total staked:{" "}
              <Near className="size-4" />
              {meme.total_staked}
            </span>
            <span class="ml-auto flex items-center gap-1">
              created by
              <span
                class="text-shitzu-4 w-40 overflow-hidden text-ellipsis flex"
              >
                {meme.owner}
              </span>
            </span>
          </div>
          <div class="w-full aspect-ratio-16/10">
            <TokenChart memebid={meme} />
          </div>
          <div class="w-full h-screen">
            <TradeTabs {meme} />
          </div>
        </div>

        <div class="w-90 p-2 flex flex-col gap-5">
          <div class="w-full h-74 border-2 border-shitzu-4 rounded-xl p-2">
            <MCStake meme_id={meme.id} />
          </div>

          <!-- Token Detail -->
          <div class="w-full text-gray-4">
            <div class="flex gap-2">
              <img src={meme.image} alt={meme.name} class="w-30" />
              <div>
                <h2>{meme.name} <b>${meme.symbol}</b></h2>
                <div class="text-sm">{meme.description}</div>
              </div>
            </div>
          </div>

          <!-- Holder -->
          <div class="w-full">
            <TokenHolder memeId={meme.id} />
          </div>
          <!-- End Right Nav -->
        </div>
      </div>
    {:else}
      <div>Meme not found</div>
    {/if}
  {:catch error}
    <div>Error: {error.message}</div>
  {/await}
</div>
