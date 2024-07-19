<script lang="ts">
  import { onDestroy } from "svelte";

  import { page } from "$app/stores";
  import Near from "$lib/assets/Near.svelte";
  import TradeTabs from "$lib/components/memecooking/Board/Desktop/TradeTabs.svelte";
  import MCStake from "$lib/components/memecooking/Board/MCStake.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import ProgressBar from "$lib/components/memecooking/ProgressBar.svelte";
  import { MemeCooking } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  // page data
  let { meme_id } = $page.params as { meme_id: string };

  let interval: number;
  function retryPromise<T>(
    fn: () => Promise<T>,
    retry: number = 10,
  ): Promise<T> {
    return new Promise((resolve) => {
      interval = setInterval(async () => {
        const result = await fn();
        retry--;
        if (result || retry === 0) {
          clearInterval(interval);
          resolve(result);
        }
      }, 1000) as unknown as number;
    });
  }

  onDestroy(() => {
    clearInterval(interval);
  });

  let meme = retryPromise(() => MemeCooking.getMemeWithReference(+meme_id), 20);
  let required_stake = MemeCooking.requiredStake(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
  );
</script>

<div class="mt-10 w-full p-2">
  <div class="mx-auto flex">
    <a href="/board" class="text-white text-2xl mx-auto mb-10">[go back]</a>
  </div>
  {#await Promise.all([meme, required_stake])}
    <div class="w-full text-center text-2xl">Loading...</div>
  {:then [meme, required_stake]}
    {#if meme}
      <div class="w-full flex">
        <Countdown
          class="mx-auto text-4xl text-shitzu-4 mb-10"
          to={meme.end_timestamp_ms}
        />
      </div>
      <div class="w-120 mx-auto mb-10">
        <ProgressBar
          progress={new FixedNumber(meme.total_staked, 24)
            .div(new FixedNumber(required_stake, 24))
            .toNumber()}
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
              {new FixedNumber(meme.total_staked, 24).format()}
            </span>
            <span
              class="ml-auto flex items-center justify-end text-right gap-1"
            >
              created by
              <a
                href={`https://pikespeak.ai/wallet-explorer/${meme.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                class="text-shitzu-4"
              >
                <Chef
                  account={meme.owner}
                  class="bg-shitzu-3 text-black px-1 rounded"
                />
              </a>
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
          <div class="w-full min-h-74 border-2 border-shitzu-4 rounded-xl p-2">
            <MCStake {meme} />
          </div>

          <!-- Link -->
          <div class="w-full flex items-center gap-2 text-gray-4">
            {#if meme.twitterLink}
              <a
                href={meme.twitterLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                [twitter]
              </a>
            {/if}
            {#if meme.telegramLink}
              <a
                href={meme.telegramLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                [telegram]
              </a>
            {/if}
            {#if meme.website}
              <a href={meme.website} target="_blank" rel="noopener noreferrer">
                [website]
              </a>
            {/if}
          </div>

          <!-- Token Detail -->
          <div class="w-full text-gray-4">
            <div class="flex gap-2">
              <img
                src={meme.image}
                alt={meme.name}
                class="w-30 object-contain"
              />
              <div>
                <h2>{meme.name} <b>{meme.symbol}</b></h2>
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
