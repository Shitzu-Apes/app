<script lang="ts">
  import { getToken$, isTokenId } from "$lib/store";
  import { FixedNumber } from "$lib/util";

  export let reward: string;
  export let share: string;

  $: tokenInfo$ = getToken$(isTokenId(reward));
  // if (reward === "bean.tkn.near") {
  //   tokenInfo$.subscribe((token) => {
  //     console.log("TKN", token);
  //   });
  // }
</script>

<li
  class="w-full border-b last:border-none border-lime px-4 py-4 flex items-center justify-between"
>
  <div>
    {#await $tokenInfo$}
      <div class="flex justify-center items-center gap-2">
        <div class="i-svg-spinners:wind-toy size-6 text-white" />
        <div class="i-svg-spinners:bars-fade size-11 text-white" />
      </div>
    {:then token}
      <div class="flex items-center gap-1">
        <img
          src={token.icon}
          alt={token.symbol}
          class="size-8 mr-2 rounded-full"
        />
        <div class="text-white">
          {token.symbol}
          <div class="text-xs md:text-sm text-gray font-400">
            {reward.slice(0, 20)}
          </div>
        </div>
      </div>
    {:catch}
      {reward}
    {/await}
  </div>
  <div>
    {#await $tokenInfo$}
      <div class="i-svg-spinners:bars-fade size-11 text-white" />
    {:then token}
      <div class="text-right font-bold text-white">
        {new FixedNumber(share, token.decimal).format()}
        <div class="text-sm text-gray font-400">
          {#if token.price != null}
            ${new FixedNumber(share, token.decimal)
              .mul(new FixedNumber(BigInt(Math.trunc(+token.price * 1e24)), 24))
              .format()}
          {/if}
        </div>
      </div>
    {:catch}
      {reward}
    {/await}
  </div>
</li>
