<script lang="ts">
  import { view } from "$lib/near/utils";

  let ranking = view<number>("rewarder.test.near", "get_leaderboard", {
    limit: null,
  });
</script>

<div class="flex flex-col">
  <h1>Leaderboard</h1>

  <div>
    {#await ranking}
      <p>Loading...</p>
    {:then ranking}
      <div>
        {JSON.stringify(ranking)}
      </div>
    {:catch error}
      <p>{error.message}</p>
    {/await}
  </div>
</div>
