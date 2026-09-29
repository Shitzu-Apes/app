<script context="module" lang="ts">
  declare global {
    interface Window {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      growthmate: any;
    }
  }
</script>

<script lang="ts">
  export let unitId: string;
  export let format: string;
  export let accountId: string | undefined = undefined;
  export let network: string | undefined = undefined;
  export let className: string | undefined = undefined;

  import { onMount, onDestroy } from "svelte";

  let mounted = false;

  $: {
    void accountId, void network;
    if (mounted && window.growthmate !== undefined)
      window.growthmate.register(unitId);
  }

  onMount(() => {
    if (window.growthmate !== undefined) window.growthmate.register(unitId);

    let script: HTMLScriptElement | null =
      document.querySelector("#gm-ad-script");
    if (!script) {
      script = document.createElement("script");
      script.src =
        "https://cdn.growthmate.xyz/scripts/ad-unit-manager.react.js";
      script.id = "gm-ad-script";
      document.head.appendChild(script);
    }

    script.addEventListener("load", () => window.growthmate.register(unitId));

    mounted = true;
  });

  onDestroy(() => {
    window.growthmate?.unregister(unitId);

    mounted = false;
  });
</script>

<a
  class="gm-ad-unit {className ?? ''}"
  data-gm-id={unitId}
  data-gm-format={format}
  data-gm-account-id={accountId ?? null}
  data-gm-network={network ?? null}
  href={undefined}
  aria-label="GrowthMate Ad"
></a>
