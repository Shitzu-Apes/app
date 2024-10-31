<script lang="ts">
  import type { Meme } from "$lib/api/client";
  import { getTokenId } from "$lib/util/getTokenId";

  export let meme: Meme;
</script>

<!-- if meme_id = -1 then show token_id -->
<code class="text-xs bg-gray-800 px-2 py-1 rounded">
  {meme.meme_id === -1 ? meme.token_id : getTokenId(meme.symbol, meme.meme_id)}
</code>
