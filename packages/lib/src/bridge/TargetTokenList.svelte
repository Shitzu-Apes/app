<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { formatBaseUnits } from "./amount";
  import type { CatalogToken } from "./catalog";
  import { CHAINS } from "./chains";
  import { iconsFor } from "./dexscreener";
  import { formatUsd, usdFor } from "./format";

  import type { Network } from "$lib/models/tokens";

  /**
   * What the user wants to receive, grouped so the list is navigable.
   *
   * Grouping is the whole point: the catalogue is every swappable token on the
   * chain, which is thousands of rows, and a flat list sorted alphabetically would
   * bury the eight tokens that can also be *bridged* under a wall of memecoins.
   *
   * The order is "what you already hold", then "what can be bridged", then
   * everything else. Holding something first is what makes a wallet with one
   * meaningful balance usable — ordering by token count buries it under a million
   * of a worthless token.
   */
  export let options: CatalogToken[];
  export let selectedId: string;
  /** The chain these tokens will be delivered on. */
  export let network: Network;
  export let prices: Record<string, number | undefined> = {};
  export let disabled = false;
  export let loading = false;
  export let searching = false;
  export let sameChain = false;
  /**
   * Whether to render the "Receive" heading.
   *
   * Off inside the To card, where the card is already labelled To. "Pay with" and
   * "Receive" were two names for "From" and "To", and asking a reader to learn
   * that mapping was the whole cost of the extra headings.
   */
  export let showHeading = true;

  const dispatch = createEventDispatcher<{
    select: string;
    search: string;
    clearSearch: void;
  }>();

  let query = "";

  /**
   * The box is emptied when the chain under it changes.
   *
   * The query used to survive a destination change, so switching chains left the old
   * chain's search words in the input and its hits under them — a list of tokens the
   * new destination cannot receive, under a placeholder saying it searched the new
   * one. The panel clears its own type-ahead for the same reason; this is the half of
   * it that lives in the input.
   */
  let lastNetwork = network;
  $: if (network !== lastNetwork) {
    lastNetwork = network;
    query = "";
  }

  /**
   * How much of the catalogue to render.
   *
   * A hundred. It was twenty, on the argument that past twenty people are scrolling a
   * list of tokens they did not choose — which is true, and which did not account for
   * the list being *sorted* before it is cut. The rows that matter are first: what the
   * account holds, then the bridge's own assets, then everything else. A limit small
   * enough to feel like a wall costs a held token its row, and USDC was exactly that —
   * present, correct, and off the screen.
   *
   * The cost is bounded rather than open: a hundred rows is a scroll, not a database,
   * and the icons are fetched only for what is rendered.
   */
  const LIST_LIMIT = 100;

  /**
   * One list, not sections.
   *
   * Splitting it into "Bridged tokens" and "All tokens" looked tidy and was worse
   * to use: the split fell along a line the user did not ask about, and the tokens
   * worth seeing — the ones they hold — were in a third bucket above both. The
   * ordering that actually helps is held-by-value first and then everything else,
   * with the bridged ones marked rather than filed away.
   */
  $: visible = query.trim() === "" ? options : options.slice(0, 40);

  /**
   * Icons, fetched for what is on screen and nothing else.
   *
   * The catalogue used to look these up for its first 60 tokens, which meant
   * opening the form cost 60 requests before a single row had been read, and the
   * same 60 again on every chain switch. A row the reader cannot see does not need
   * artwork, so the request follows the render: at most `LIST_LIMIT` of them, once,
   * and cached for the life of the page by the lookup itself.
   */
  let fetchedIcons: Record<string, string> = {};

  $: void loadIcons(visible.slice(0, LIST_LIMIT), network);

  let iconRequest = 0;
  async function loadIcons(rows: CatalogToken[], chain: Network) {
    // Only a token with no icon at all is worth a request. An unknown result is
    // cached as unknown by the lookup, so it is never asked for twice.
    const missing = rows
      .filter((row) => !row.icon && !fetchedIcons[row.address])
      .map((row) => row.address);
    if (missing.length === 0) return;

    // A newer list superseded this one mid-flight; its result is not wanted.
    const ticket = ++iconRequest;
    const found = await iconsFor(chain, missing);
    if (ticket !== iconRequest) return;
    if (found.size === 0) return;
    fetchedIcons = { ...fetchedIcons, ...Object.fromEntries(found) };
  }

  /**
   * The artwork to render for a row.
   *
   * Whatever the token has, in whatever form. Inlined `data:` icons used to be
   * dropped here on the theory that thousands of base64 blobs is a lot to push
   * through a picker — but that theory was priced against a 1,681-token list, and
   * the list is 77 now. Paying the cost is much cheaper than the alternative,
   * because a dropped icon is not merely ugly, it is *unrecoverable in the cases
   * that matter*: POPPY and XAUT are inlined by the app itself, and CHILL has no
   * DexScreener pool at all, so discarding its icon left it with nothing to fall
   * back to. Every bridgeable token in the list rendered as a grey circle.
   */
  function iconOf(token: CatalogToken): string {
    return token.icon || fetchedIcons[token.address] || "";
  }

  function priceOf(token: CatalogToken): number | undefined {
    return token.price ?? prices[token.tokenId];
  }
</script>

<div class="mb-2 flex items-center justify-between gap-2">
  {#if showHeading}
    <span
      class="text-xs font-semibold uppercase tracking-wide text-shitzu-3 shrink-0"
    >
      Receive
    </span>
  {/if}
  {#if sameChain}
    <span class="text-[10px] text-shitzu-2">
      Same chain — a swap, no bridge
    </span>
  {:else if !loading}
    <span class="text-xs text-shitzu-2">
      {options.length}
      {options.length === 1 ? "token" : "tokens"} on {CHAINS[network].name}
    </span>
  {/if}
</div>

<!--
  The catalogue is far too long to scroll blind, so there is a search. On NEAR it
  is a genuine type-ahead against the Intear indexer; on Solana it filters what is
  already loaded, which is the honest difference between a query API and a list.
-->
<div class="relative mb-2">
  <input
    type="search"
    bind:value={query}
    placeholder="Search {CHAINS[network].name} tokens"
    class="w-full bg-white/5 text-shitzu-1 border border-shitzu-4/45 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-shitzu-4/50 placeholder:text-shitzu-500"
    on:input={() => dispatch("search", query)}
  />
  {#if query}
    <button
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 text-shitzu-2 hover:text-shitzu-1"
      on:click={() => {
        query = "";
        dispatch("clearSearch");
      }}
      aria-label="Clear the search"
    >
      <span class="i-mdi:close text-sm" aria-hidden="true" />
    </button>
  {/if}
</div>

{#if options.length === 0 && !loading && !searching}
  <div
    class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 text-sm text-shitzu-2"
  >
    {#if query}
      No token matches “{query}”.
    {:else}
      Nothing is available on this chain right now. Bridging a token unchanged
      is still available from the Bridge tab.
    {/if}
  </div>
{:else if query && !searching && visible.length === 0}
  <!--
    A search with no results is a distinct state from an empty catalogue: the list
    is populated, the query just did not match. Saying "nothing is available" there
    would be plainly false.
  -->
  <div
    class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 text-sm text-shitzu-2"
  >
    No token matches “{query}”.
  </div>
{:else if (loading || searching) && options.length === 0}
  <div
    class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 text-sm text-shitzu-2 flex items-center gap-2"
  >
    <span class="i-mdi:loading animate-spin" aria-hidden="true" />
    Loading tokens…
  </div>
{:else}
  <!--
    `p-0 m-0` are explicit for the same reason `list-none` is. The reset zeroes a
    `ul`'s padding, but inheriting that is a bet on a stylesheet this component
    does not control, and a browser's own list padding shows up as a strip of dead
    space down the left of every row.
  -->
  <ul
    class="list-none p-0 m-0 max-h-72 overflow-y-auto overscroll-contain noscrollbar rounded-xl border border-shitzu-4/45 divide-y divide-shitzu-4/20"
  >
    {#each visible.slice(0, LIST_LIMIT) as option (option.tokenId)}
      <li>
        <button
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors {selectedId ===
          option.tokenId
            ? 'bg-shitzu-4/15'
            : 'hover:bg-white/5'}"
          {disabled}
          aria-pressed={selectedId === option.tokenId}
          on:click={() => dispatch("select", option.tokenId)}
        >
          {#if iconOf(option)}
            <img
              src={iconOf(option)}
              alt=""
              class="w-7 h-7 rounded-full shrink-0"
              loading="lazy"
            />
          {:else}
            <span class="w-7 h-7 rounded-full bg-shitzu-4/20 shrink-0" />
          {/if}

          <span class="flex-1 min-w-0">
            <span class="flex items-center gap-1.5">
              <span class="text-sm font-semibold truncate">
                {option.symbol}
              </span>
              {#if option.bridgeable}
                <span
                  class="text-[10px] px-1 py-0.5 rounded bg-shitzu-4/20 text-shitzu-2 shrink-0"
                >
                  bridgeable
                </span>
              {/if}
            </span>
            <span class="block text-xs text-shitzu-2">
              {#if option.held !== undefined && option.held > 0n}
                {formatBaseUnits(option.held, option.decimals)}
              {:else}
                on {CHAINS[network].name}
              {/if}
            </span>
          </span>

          <span class="text-xs text-shitzu-2 shrink-0 text-right">
            {#if option.heldUsd !== undefined && option.heldUsd > 0}
              {formatUsd(option.heldUsd)}
            {:else}
              {usdFor(
                10n ** BigInt(option.decimals),
                option.decimals,
                priceOf(option),
              )}
            {/if}
          </span>

          <div
            class="w-4 h-4 rounded-full border-2 shrink-0 {selectedId ===
            option.tokenId
              ? 'border-shitzu-4 bg-shitzu-4'
              : 'border-shitzu-4/45'}"
          />
        </button>
      </li>
    {/each}
  </ul>
  {#if !query && options.length > LIST_LIMIT}
    <div class="text-[11px] text-shitzu-2 mt-1.5 px-1">
      Showing {LIST_LIMIT} of {options.length}. Search to find another.
    </div>
  {/if}
{/if}
