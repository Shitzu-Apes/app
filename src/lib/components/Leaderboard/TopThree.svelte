<script lang="ts">
  import RetroGrid from "../RetroGrid.svelte";
  import Squircle from "../Squircle.svelte";

  import type { FixedNumber } from "$lib/util";

  export let topThree: Array<{
    token_id: string;
    account_id: string | null;
    score: FixedNumber;
    rank: number;
  }> = [];

  const BASE_URL = import.meta.env.VITE_NFT_BASE_URL;
</script>

<ol
  class="w-full bg-gradient-to-b bg-gradient-from-lime bg-gradient-to-emerald rounded-b-2xl py-3 overflow-hidden relative"
>
  <RetroGrid />
  <div class="w-full flex justify-end z-1">
    <a
      href="#FAQ"
      class="text-black flex text-sm items-center mb-3 mr-3 gap-0.5"
    >
      FAQ
      <div class="i-mdi:help-circle-outline size-5" />
    </a>
  </div>

  {#if topThree.length > 0}
    <!-- First place -->
    <li class="flex flex-col items-center">
      <a href="/shitstars/{topThree[0].token_id}" class="relative mb-4">
        <Squircle
          src="{BASE_URL}/{topThree[0].token_id}.png"
          class="text-amber size-34"
        />
        <div
          class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-amber text-black text-center rounded-full size-7 font-bold flex justify-center items-center"
        >
          1
        </div>
      </a>

      <div
        class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
      >
        {topThree[0].account_id}
      </div>
      <div
        class="font-bold text-lg bg-amber rounded-full px-2 mt-2 text-black flex items-center gap-1"
      >
        <div class="i-mdi:stars size-6" />
        {topThree[0].score.format()}
      </div>
    </li>
  {/if}

  <!-- Second and Third place -->
  <div class="w-full flex justify-between px-2 -mt-4 z-1 relative">
    {#if topThree.length > 1}
      <li class="flex flex-col items-center">
        <a href="/shitstars/{topThree[1].token_id}" class="relative mb-4">
          <Squircle
            class="size-28 text-coolgray"
            src="{BASE_URL}/{topThree[1].token_id}.png"
          />
          <div
            class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-coolgray text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
          >
            2
          </div>
        </a>

        <div
          class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
        >
          {topThree[1].account_id}
        </div>
        <div
          class="font-bold text-lg bg-coolgray rounded-full px-2 mt-2 text-black flex items-center gap-1"
        >
          <div class="i-mdi:stars size-6" />
          {topThree[1].score.format()}
        </div>
      </li>
    {/if}

    {#if topThree.length > 2}
      <!-- Third Place -->
      <li class="flex flex-col items-center">
        <a href="/shitstars/{topThree[2].token_id}" class="relative mb-4">
          <Squircle
            class="size-28 text-red"
            src="{BASE_URL}/{topThree[2].token_id}.png"
          />
          <div
            class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-red text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
          >
            3
          </div>
        </a>

        <div
          class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
        >
          {topThree[2].account_id}
        </div>
        <div
          class="font-bold text-lg bg-red rounded-full px-2 mt-2 text-black flex items-center gap-1"
        >
          <div class="i-mdi:stars size-6" />
          {topThree[2].score.format()}
        </div>
      </li>
    {/if}
  </div>
</ol>
