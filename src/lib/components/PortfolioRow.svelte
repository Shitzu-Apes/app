<script lang="ts">
  import FormatNumber from "./FormatNumber.svelte";
  import McIcon from "./MCIcon.svelte";
  import SendSheet from "./memecooking/BottomSheet/SendSheet.svelte";

  import type { Portfolio } from "$lib/api/queries/portfolio";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { FixedNumber } from "$lib/util";

  type Token = Portfolio["tokens"][number];

  export let token: Token;
  export let isOwnAccount: boolean;
  export let index: number;
  export let decimals: number = token.decimals ?? 24;
  export let nearPrice: FixedNumber;

  $: balance = new FixedNumber(token.balance, decimals);
  $: price = token.price
    ? new FixedNumber(BigInt(Math.round(token.price * 1e24)), 24)
    : null;
  $: value = price ? balance.mul(price).mul(nearPrice).toNumber() : 0;
  $: mcap =
    token.total_supply && price
      ? new FixedNumber(token.total_supply, decimals)
          .mul(price)
          .mul(nearPrice)
          .toNumber()
      : 0;
</script>

<tr class="{index % 2 === 0 ? 'bg-gray-700/20' : ''} hover:bg-gray-800/50">
  <td class="px-4 py-3 truncate max-w-[200px]">
    {#if token.image}
      <a
        href={`/meme/${token.meme_id && token.meme_id < 0 ? token.contract_id : token.meme_id}`}
        class="flex items-center gap-3 hover:opacity-80 hover:text-shitzu-4"
      >
        {#key token.image}
          <McIcon
            meme={{ image: token.image, name: token.contract_id }}
            class="w-8 h-8 rounded-full"
          />
        {/key}
        <div class="flex flex-col">
          <span class="font-medium flex items-center gap-1">
            {token.name || token.contract_id}
            <span class="text-xs text-gray-400"
              >({token.symbol || token.contract_id})</span
            >
          </span>
          <span class="text-xs text-gray-400 sm:hidden">
            $<FormatNumber number={value} totalDigits={6} />
          </span>
          <span class="text-xs text-gray-400 hidden sm:block">
            {token.contract_id}
          </span>
        </div>
      </a>
    {:else}
      <div class="flex flex-col">
        <span class="font-medium">
          {token.symbol || token.name || token.contract_id}
        </span>
        <span class="text-xs text-gray-400">${value.toFixed(4)}</span>
      </div>
    {/if}
  </td>
  <td class="px-4 py-3 text-right">
    <div class="flex flex-col items-end">
      <span class="font-medium">
        <FormatNumber number={balance.toNumber()} totalDigits={6} />
      </span>
      <span class="text-xs text-gray-400">${value.toFixed(2)}</span>
    </div>
  </td>
  <td class="hidden sm:table-cell px-4 py-3 text-right font-medium">
    $<FormatNumber number={value} totalDigits={6} />
  </td>
  <td class="hidden sm:table-cell px-4 py-3 text-right font-medium">
    {#if mcap}
      $<FormatNumber number={mcap} totalDigits={6} />
    {:else}
      <span class="text-gray-400">-</span>
    {/if}
  </td>
  {#if isOwnAccount}
    <td class="hidden sm:flex py-3 text-right flex-col items-center gap-1">
      <button
        class="px-1 py-1 bg-shitzu-4 hover:bg-shitzu-5 text-white rounded-md text-sm flex flex-col items-center gap-1"
        on:click={() => {
          openBottomSheet(SendSheet, { meme: token });
        }}
      >
        <div class="i-mdi:arrow-right" />
      </button>
      <span class="text-xs text-gray-400">send</span>
    </td>
  {/if}
</tr>
