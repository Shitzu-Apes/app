<script lang="ts">
  import { slide } from "svelte/transition";

  import SHITZU_LIKE from "$lib/assets/static/shitzu_like.png";
  import RefWhitelistSheet from "$lib/components/memecooking/BottomSheet/RefWhitelistSheet.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";

  export let meme: Meme;
  const { accountId$ } = wallet;
</script>

{#if $accountId$ === meme.owner && meme.pool_id}
  <div out:slide class="bg-gray-800 rounded-lg p-4 mb-4">
    <div class="grid grid-cols-3 gap-4">
      <div class="flex items-center justify-center">
        <img src={SHITZU_LIKE} class="w-full" alt="Shitzu Like" />
      </div>
      <div class="col-span-2 h-full">
        <div class="flex flex-col gap-6 justify-between h-full p-2">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <div class="i-mdi:rocket-launch text-shitzu-3 text-3xl" />
              <h3 class="text-lg font-semibold text-gray-300">
                Ready for Ref Finance
              </h3>
            </div>
          </div>

          <button
            on:click={() => openBottomSheet(RefWhitelistSheet, { meme })}
            class="py-2 w-full bg-shitzu-3 text-black hover:brightness-110 rounded-md flex items-center justify-center gap-2 font-medium text-sm"
          >
            Request Ref Finance Whitelist
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
