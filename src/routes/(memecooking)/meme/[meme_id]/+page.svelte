<script lang="ts">
  import { page } from "$app/stores";
  import MCStake from "$lib/components/memecooking/Board/MCStake.svelte";
  import { MemeCooking } from "$lib/near";

  // page data
  let { meme_id } = $page.params;

  let meme = MemeCooking.getMemeWithReference(+meme_id);
</script>

{#await meme}
  <div>Loading...</div>
{:then meme}
  {#if meme}
    <div>
      <h1>{meme.name}</h1>
      <img src={meme.image} alt={meme.name} />
      <p>{meme.description}</p>

      <MCStake meme_id={meme.id} />
    </div>
  {:else}
    <div>Meme not found</div>
  {/if}
{:catch error}
  <div>Error: {error.message}</div>
{/await}
