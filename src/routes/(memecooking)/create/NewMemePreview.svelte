<script lang="ts">
  import MemePreview from "$lib/components/memecooking/Board/Desktop/MemePreview.svelte";
  import SocialLink from "$lib/components/memecooking/Board/SocialLink.svelte";
  import StatusBar from "$lib/components/memecooking/Board/StatusBar.svelte";
  import TeamAllocation from "$lib/components/memecooking/Board/TokenAllocation.svelte";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
</script>

<!-- Right Column - Actions & Info -->
<div class="space-y-4 pointer-events-none">
  <MemePreview memebid={meme} />
  <!-- Trading Status -->
  <div class="bg-gray-800 rounded-lg p-4 pb-0">
    <StatusBar {meme} expanded />
  </div>

  <!-- Token Details -->
  <div class="bg-gray-800 rounded-lg p-4">
    <h3 class="text-lg font-bold mb-4">
      About
      <span class="text-shitzu-400 font-medium">${meme.symbol}</span>
    </h3>
    <p class="text-gray-300 mb-4 break-words">{meme.description}</p>
    <!-- Social Links -->
    <SocialLink
      twitterLink={meme.twitterLink || ""}
      telegramLink={meme.telegramLink || ""}
      website={meme.website || ""}
    />
  </div>

  <!-- Token Holders -->
  {#if meme.team_allocation_num && typeof meme.vesting_duration_ms === "number" && typeof meme.cliff_duration_ms === "number"}
    <div class="bg-gray-800 rounded-lg p-4">
      <TeamAllocation {meme} />
    </div>
  {/if}
</div>
