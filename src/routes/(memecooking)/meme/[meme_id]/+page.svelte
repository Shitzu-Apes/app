<script lang="ts">
  import { page } from "$app/stores";
  import MCStake from "$lib/components/memecooking/Board/MCStake.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenComment from "$lib/components/memecooking/Board/TokenComment.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import { MemeCooking } from "$lib/near";

  // page data
  let { meme_id } = $page.params;

  let meme = MemeCooking.getMemeWithReference(+meme_id);
</script>

<div class="mt-10 w-full">
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
          <div class="w-full aspect-ratio-16/10">
            <TokenChart memebid={meme} />
          </div>
          <div class="w-full h-screen">
            <TokenComment id={+meme_id} />
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
