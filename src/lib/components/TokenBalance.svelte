<script lang="ts">
  import {
    isTokenId,
    useTokenMetadataQuery,
    useTokenPriceQuery,
  } from "$lib/api/queries/tokens";
  import { FixedNumber } from "$lib/util";

  export let reward: string;
  export let share: string;

  $: tokenId = isTokenId(reward);
  $: tokenMetadata = useTokenMetadataQuery(tokenId);
  $: tokenPrice = useTokenPriceQuery(tokenId);
  // if (reward === "bean.tkn.near") {
  //   tokenInfo$.subscribe((token) => {
  //     console.log("TKN", token);
  //   });
  // }
</script>

<li
  class="w-full border-b last:border-none border-lime px-4 py-4 flex items-center justify-between"
>
  <div class="text-white">
    {#if $tokenMetadata.isLoading}
      <div class="flex justify-center items-center gap-2">
        <div class="i-svg-spinners:wind-toy size-6 text-white" />
        <div class="i-svg-spinners:bars-fade size-11 text-white" />
      </div>
    {:else if $tokenMetadata.data}
      <div class="flex items-center gap-1">
        <img
          src={$tokenMetadata.data.icon}
          alt={$tokenMetadata.data.symbol}
          class="size-8 mr-2 rounded-full"
        />
        <div class="text-white">
          {$tokenMetadata.data.symbol}
          <div class="text-xs md:text-sm text-gray font-400">
            {reward.slice(0, 20)}
          </div>
        </div>
      </div>
    {:else}
      {reward}
    {/if}
  </div>
  <div>
    {#if $tokenMetadata.isLoading}
      <div class="i-svg-spinners:bars-fade size-11 text-white" />
    {:else if $tokenMetadata.data}
      <div class="text-right font-bold text-white">
        {new FixedNumber(share, $tokenMetadata.data.decimal).format()}
        <div class="text-sm text-gray font-400">
          {#if $tokenPrice.data}
            ${new FixedNumber(share, $tokenMetadata.data.decimal)
              .mul(
                new FixedNumber(
                  BigInt(Math.trunc(+$tokenPrice.data * 1e24)),
                  24,
                ),
              )
              .format()}
          {:else if $tokenPrice.isLoading}
            <span
              class="inline-block i-svg-spinners:3-dots-fade size-4 text-white"
            />
          {/if}
        </div>
      </div>
    {:else}
      {reward}
    {/if}
  </div>
</li>
