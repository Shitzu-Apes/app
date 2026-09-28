<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { formatBaseUnits } from "./amount";
  import type { SourceOption } from "./format";
  import { formatUsd } from "./format";

  /**
   * Balances render through the shared formatter rather than a local one, so a
   * tiny holding shows significant digits instead of rounding to "0" and looking
   * like an empty account.
   */
  const formatTokenBalance = (balance: bigint, decimals: number): string =>
    formatBaseUnits(balance, decimals);

  /**
   * A scrollable list of tokens to pay with, mirroring the Solana-to-NEAR sheet.
   *
   * A `<select>` was the obvious thing to reach for and the wrong one: it cannot
   * show an icon, a balance and a USD value side by side, and on a phone it
   * collapses all of that to a single line of text. It also loses the one piece
   * of information that matters most here — that a token exists but has no route
   * — because a disabled option and a missing option look the same.
   *
   * Rows stay mounted while the list is loading and while a transfer runs, rather
   * than being replaced by a spinner: the form is a record of what was submitted,
   * and blanking it at the moment the wallet opens loses the context the user
   * needs to check what they are signing.
   */
  export let options: SourceOption[];
  export let selectedId: string;
  export let loading = false;
  export let disabled = false;
  export let emptyMessage = "No tokens found in this wallet.";
  /**
   * Whether to render the "Pay with" heading.
   *
   * Off inside the From card, where the card is already labelled From and the
   * heading repeated it in different words — a reader had to work out that "Pay
   * with" and "From" were the same slot. On by default so the component still
   * reads correctly anywhere else.
   */
  export let showHeading = true;

  const dispatch = createEventDispatcher<{ select: string }>();
</script>

<div class="flex items-center justify-between mb-2">
  {#if showHeading}
    <span class="text-xs font-semibold uppercase tracking-wide text-shitzu-3">
      Pay with
    </span>
  {/if}
  {#if loading}
    <div class="i-mdi:loading animate-spin text-shitzu-3 text-sm" />
  {:else}
    <span class="text-xs text-shitzu-2">
      {options.length}
      {options.length === 1 ? "token" : "tokens"}
    </span>
  {/if}
</div>

{#if options.length === 0 && !loading}
  <div
    class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 text-sm text-shitzu-2"
  >
    {emptyMessage}
  </div>
{:else}
  <!--
    `p-0 m-0` are explicit, not decoration.

    `list-none` removes the marker, and a marker renders outside the list's content
    box — so relying on a reset to suppress it is a bet on a stylesheet this
    component does not control. The UA's `padding-inline-start: 40px` is the same
    trap and is the one that actually bit: the receive list reset it and this one
    did not, so every "Pay with" row sat 40px in from the card's border and read as
    a stray indent beside the tokens. The reset in this project does not cover
    either property.
  -->
  <ul
    class="list-none p-0 m-0 max-h-56 overflow-y-auto overscroll-contain noscrollbar rounded-xl border border-shitzu-4/45 divide-y divide-shitzu-4/20"
  >
    {#each options as option (option.id)}
      <li>
        <button
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors {selectedId ===
          option.id
            ? 'bg-shitzu-4/15'
            : 'hover:bg-white/5'}"
          {disabled}
          aria-pressed={selectedId === option.id}
          on:click={() => dispatch("select", option.id)}
        >
          {#if option.icon}
            <img
              src={option.icon}
              alt=""
              class="w-7 h-7 rounded-full shrink-0"
              loading="lazy"
            />
          {:else}
            <span class="w-7 h-7 rounded-full bg-shitzu-4/20 shrink-0" />
          {/if}

          <span class="flex-1 min-w-0">
            <span class="flex items-center gap-1.5">
              <span class="text-sm font-semibold truncate">{option.symbol}</span
              >
              {#if !option.routable}
                <span
                  class="text-[10px] px-1 py-0.5 rounded bg-shitzu-4/20 text-shitzu-2 shrink-0"
                >
                  no route
                </span>
              {/if}
            </span>
            <span class="block text-xs text-shitzu-2">
              {option.balance > 0n
                ? formatTokenBalance(option.balance, option.decimals)
                : "No balance"}
            </span>
          </span>

          <span class="text-xs text-shitzu-2 shrink-0 text-right">
            {option.usdValue !== undefined && option.usdValue > 0
              ? formatUsd(option.usdValue)
              : ""}
          </span>

          <div
            class="w-4 h-4 rounded-full border-2 shrink-0 {selectedId ===
            option.id
              ? 'border-shitzu-4 bg-shitzu-4'
              : 'border-shitzu-4/45'}"
          />
        </button>
      </li>
    {/each}
  </ul>
{/if}
