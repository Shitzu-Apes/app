<script lang="ts">
  import { CHAINS } from "./chains";
  import { CONVERT_CHAINS, type ConvertChain } from "./rail";

  /**
   * One end of the transfer: a label, a chain, and the address that will send or
   * receive.
   */
  export let label: "From" | "To";
  export let network: ConvertChain;
  export let address: string | undefined;
  export let connected: boolean;
  export let onPick: (chain: ConvertChain) => void;
  export let onConnect: () => void;
  /**
   * Whether to draw this end's own card.
   *
   * Off when it sits inside the From or To card, which already provides the
   * border and the background. A nested card reads as a panel within a panel and
   * puts a second rule between the chain name and the tokens that belong to it.
   */
  export let bare = false;

  $: icon = CHAINS[network].icon;
  $: name = CHAINS[network].name;
</script>

<div class={bare ? "" : "rounded-xl bg-white/5 border border-shitzu-4/45 p-3"}>
  <div class="text-xs font-semibold uppercase tracking-wide text-shitzu-3">
    {label}
  </div>

  <div class="flex items-center gap-1 mt-1.5">
    {#each CONVERT_CHAINS as chain (chain)}
      <button
        type="button"
        class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors {network ===
        chain
          ? 'bg-shitzu-4/20 text-shitzu-1'
          : 'text-shitzu-2 hover:bg-white/5'}"
        aria-pressed={network === chain}
        on:click={() => onPick(chain)}
      >
        <img src={CHAINS[chain].icon} alt="" class="w-4 h-4 rounded-full" />
        {CHAINS[chain].name}
      </button>
    {/each}
  </div>

  {#if connected && address}
    <div class="flex items-center gap-2 mt-2">
      <img src={icon} alt={name} class="w-5 h-5 rounded-full" />
      <span class="font-mono text-sm break-all">{address}</span>
    </div>
  {:else}
    <button
      type="button"
      class="mt-2 w-full px-4 py-2 rounded-lg text-sm bg-shitzu-4 text-black font-semibold hover:bg-shitzu-5 transition-colors"
      on:click={onConnect}
    >
      Connect {name} wallet
    </button>
  {/if}
</div>
