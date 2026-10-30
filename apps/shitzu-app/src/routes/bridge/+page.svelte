<script lang="ts">
  import AnyToAnyPanel from "$lib/bridge/AnyToAnyPanel.svelte";
  import NativeBridgePanel from "$lib/bridge/NativeBridgePanel.svelte";
  import OmniBridgeSheet from "$lib/bridge/OmniBridgeSheet.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

  /**
   * Two ways to cross, because they answer different questions.
   *
   * **Bridge** moves a token the bridge already carries between the chains it is
   * registered on, unchanged. One transfer, no swaps, and it is the only path
   * that reaches the EVM chains.
   *
   * **Convert** moves any token into any deliverable token, by swapping into a
   * bridgeable token, bridging that, and swapping out. It searches over which
   * token to bridge rather than assuming one, which matters more than it sounds:
   * routing USDC to SHITZU on Solana through wNEAR cannot complete at all,
   * because Jupiter will not trade SHITZU there, while swapping to SHITZU on NEAR
   * first needs no second swap.
   *
   * The panels are separate rather than one form with a mode switch, because they
   * have genuinely different shapes — a chain grid and a recipient field against a
   * target token and a ranked route list — and forcing them into one component
   * would make both worse.
   */
  /**
   * Temporary shutdown: the page stays mounted, but no bridge or convert UI is
   * rendered, so nothing can be signed from here. Flip to false to restore.
   */
  const MAINTENANCE = true;

  type Mode = "bridge" | "convert";

  /**
   * Convert leads, because it is the thing this page is for. Bridging a token
   * unchanged is the older, narrower job and is still one tap away.
   */
  let mode: Mode = "convert";

  const TABS: { id: Mode; label: string; hint: string }[] = [
    {
      id: "convert",
      label: "Convert",
      hint: "Swap into any token on the other chain",
    },
    { id: "bridge", label: "Bridge", hint: "Move a token unchanged" },
  ];
</script>

<div class="w-full">
  <!--
    The header sits above the toggle because it names the page, not a mode: both
    flows are the same bridge, and the toggle is a choice about what to send
    rather than about where you are.
  -->
  <div class="text-center mb-5">
    <h1 class="mb-0">OmniBridge</h1>
    <div>Transfer tokens between networks</div>
    {#if !MAINTENANCE}
      <button
        on:click={() => openBottomSheet(OmniBridgeSheet)}
        class="inline-block mt-2 text-sm text-lime/70 hover:text-lime transition-colors"
      >
        Learn more about NEAR's next-gen cross-chain infrastructure →
      </button>
    {/if}
  </div>

  {#if MAINTENANCE}
    <div
      class="max-w-md mx-auto px-6 py-10 text-center not-prose rounded-xl border border-lime/30 bg-lime/5"
      role="status"
    >
      <div
        class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-lime/15 text-lime"
      >
        <div class="i-mdi:tools size-6" />
      </div>
      <h2 class="text-lg font-bold text-lime">Under maintenance</h2>
      <p class="mt-2 text-sm text-white/70">
        Bridge and convert are temporarily paused. Please check back soon.
      </p>
    </div>
  {:else}
    <div
      class="flex rounded-xl border border-lime/30 overflow-hidden mb-4"
      role="tablist"
      aria-label="What to do"
    >
      {#each TABS as tab (tab.id)}
        <button
          type="button"
          role="tab"
          aria-selected={mode === tab.id}
          class="flex-1 px-3 py-2.5 transition-colors {mode === tab.id
            ? 'bg-lime text-black'
            : 'text-lime/70 hover:bg-lime/10'}"
          on:click={() => (mode = tab.id)}
        >
          <div class="text-sm font-semibold">{tab.label}</div>
          <div
            class="text-[11px] leading-tight {mode === tab.id
              ? 'text-black/70'
              : 'text-lime/40'}"
          >
            {tab.hint}
          </div>
        </button>
      {/each}
    </div>

    {#if mode === "bridge"}
      <NativeBridgePanel />
    {:else}
      <AnyToAnyPanel />
    {/if}
  {/if}
</div>
