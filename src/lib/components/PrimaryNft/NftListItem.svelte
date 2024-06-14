<script lang="ts">
  import Squircle from "../Squircle.svelte";

  import { Rewarder } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let isSelectedToken: boolean = false;
  export let tokenId: string;

  const score = Rewarder.scoreOf(tokenId);
</script>

<div class="flex flex-col items-center">
  <button
    class="relative"
    class:border-transparent={!isSelectedToken}
    class:border-lime={isSelectedToken}
    on:click
  >
    <Squircle
      class="size-24 text-lime-2"
      src="{import.meta.env.VITE_NFT_BASE_URL}/{tokenId}.png"
    />

    <!-- banner bottom center of the image to show token id -->
    <div
      class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 translate-y-0 bg-lime-2 text-black text-center px-2 rounded-full font-bold flex justify-center items-center"
    >
      <div class="relative size-5">
        <div
          class="absolute inset-0 i-mdi:check-box-outline size-5 text-current"
          class:opacity-0={!isSelectedToken}
        />
        <div
          class="absolute inset-0 i-mdi:check-box-outline-blank size-5 opacity-0 text-black"
          class:opacity-100={!isSelectedToken}
        />
      </div>
      {tokenId}
    </div>
  </button>
  <div class="min-h-10 w-full flex justify-center mt-3 items-center">
    {#await score}
      <div class="i-svg-spinners:bouncing-ball size-10" />
    {:then score}
      <div class="flex items-center gap-1 text-lime-2">
        <div class="i-mdi:stars size-4 text-lime-2" />
        {new FixedNumber(score, 18).format()}
      </div>
    {/await}
  </div>
</div>
