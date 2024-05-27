<script lang="ts">
  import { getToken$ } from "$lib/store";
  import { FixedNumber } from "@tarnadas/fixed-number";

  export let reward: string;
  export let share: string;

  $: tokenInfo$ = getToken$(reward);
</script>

<tr>
  <td class="border border-lime px-4 py-2"
    >{#await $tokenInfo$}
      <div class="i-svg-spinners:pulse-3 size-6 text-lime" />
    {:then token}
      <div class="flex items-center gap-1">
        <img
          src={token.icon}
          alt={token.symbol}
          class="size-4 mr-2 rounded-full"
        />
        {token.symbol}
      </div>
    {:catch}
      {reward}
    {/await}
  </td>
  <td class="border border-lime px-4 py-2">
    {#await $tokenInfo$}
      <div class="i-svg-spinners:pulse-3 size-6" />
    {:then token}
      {new FixedNumber(share, token.decimal).format()}
    {:catch}
      {reward}
    {/await}
  </td>
</tr>
