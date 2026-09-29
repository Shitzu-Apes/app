<script lang="ts">
  import type { Meme } from "$lib/api/client";

  const AUTHORIZE_URI =
    import.meta.env.VITE_MEME_COOKING_API + "/auth/x-callback/authorize";

  export let meme: Meme;

  async function handleSignIn() {
    window.location.href = `${AUTHORIZE_URI}?meme_id=${meme.meme_id}`;
  }
</script>

<button
  on:click={handleSignIn}
  class="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg font-medium transition-colors"
  aria-label={`Verify ${meme.symbol} with X (Twitter)`}
>
  <div class="i-mdi:check-decagram text-lg" />
  <span>Verify {meme.symbol}</span>
  <div class="i-mdi:twitter text-lg" />
  <span class="sr-only">with X (Twitter)</span>
</button>
