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
      <div class="i-svg-spinners:pulse-3 size-6 text-lime" />
    {:then token}
      <div class="flex items-center gap-1">
        <img
          src={token.icon}
          alt={token.symbol}
          class="size-8 mr-2 rounded-full"
        />
        <div>
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
      <div class="i-svg-spinners:pulse-3 size-6" />
    {:then token}
      <div class="text-right font-bold">
        {new FixedNumber(share, token.decimal).format()}
        <div class="text-sm text-gray font-400">
          ${new FixedNumber(share, token.decimal)
            .mul(new FixedNumber(BigInt(Math.trunc(+token.price * 1e24)), 24))
            .format()}
        </div>
      </div>
    {:catch}
      {reward}
    {/await}
  </div>
</li>
