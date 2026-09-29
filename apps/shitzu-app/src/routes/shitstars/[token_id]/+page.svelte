<script lang="ts">
  import type { PageData } from "./$types";

  import Shitstar from "$lib/components/Shitstar.svelte";

  export let data: PageData;
  const {
    props: { token_id },
  } = data;
</script>

<a href="/shitstars" class="mr-auto my-3">
  <div class="i-mdi:arrow-left size-8" />
</a>
<Shitstar {token_id} />
