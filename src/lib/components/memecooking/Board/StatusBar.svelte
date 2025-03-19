<script lang="ts">
  import { quintOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  import Countdown from "../Countdown.svelte";

  import RadialProgressBar from "./Desktop/RadialProgressBar.svelte";
  import ExtraDetailWithVisual from "./ExtraDetailWithVisual.svelte";

  import REF_LOGO from "$lib/assets/logo/ref.png";
  import { EXTERNAL_MEMES } from "$lib/external_memes";
  import type { Meme } from "$lib/models/memecooking";
  import { createProgressBarData } from "$lib/util/progressBarLogic";

  export let meme: Meme;

  $: reachedMcap =
    BigInt(meme.total_deposit ?? "0") >= BigInt(meme.soft_cap ?? "0");
  let props = createProgressBarData(meme);
  $: props = createProgressBarData(meme);

  export let expanded = false;
  $: isExternalMeme = EXTERNAL_MEMES.some((m) => m.meme_id === meme.meme_id);
  $: hasStartTime =
    meme.start_timestamp_ms &&
    parseInt(String(meme.start_timestamp_ms)) > Date.now();
</script>

<div class="w-full flex flex-col gap-4">
  <div class="w-full flex gap-4">
    {#if meme.pool_id}
      <button
        class="w-full"
        class:cursor-default={isExternalMeme}
        on:click={() => !isExternalMeme && (expanded = !expanded)}
      >
        <div
          class="text-white p-2 text-center font-medium mb-4 flex items-center justify-center gap-2"
        >
          <img src={REF_LOGO} alt="Ref Logo" class="size-6" />
          <span>Trade on Ref via Meme.Cooking</span>
        </div>
        {#if !isExternalMeme}
          <div class="flex justify-center border-t border-gray-700">
            <div
              class="i-mdi:chevron-down size-6 text-gray-300 transition-transform duration-200 ease-in-out"
              style="transform: rotate({expanded ? '180deg' : '0deg'})"
            />
          </div>
        {/if}
      </button>
    {:else if meme.end_timestamp_ms && meme.end_timestamp_ms < Date.now()}
      <button
        class="w-full"
        class:cursor-default={isExternalMeme}
        on:click={() => !isExternalMeme && (expanded = !expanded)}
      >
        {#if reachedMcap}
          <div class="w-full text-center p-2 mb-4 bg-amber-4 text-white">
            pending launch
          </div>
        {:else}
          <div class="w-full text-center p-2 mb-4 bg-rose-4 text-white">
            didn't make it
          </div>
        {/if}
        {#if !isExternalMeme}
          <div class="flex justify-center border-t border-gray-700">
            <div
              class="i-mdi:chevron-down size-6 text-gray-300 transition-transform duration-200 ease-in-out"
              style="transform: rotate({expanded ? '180deg' : '0deg'})"
            />
          </div>
        {/if}
      </button>
    {:else if hasStartTime}
      <button
        class="w-full flex flex-col items-stretch"
        class:cursor-default={isExternalMeme}
        on:click={() => !isExternalMeme && (expanded = !expanded)}
      >
        <div class="flex w-full justify-between items-center">
          <div class="w-1/2 flex flex-col justify-start items-start">
            <div class="text-gray-400">Scheduled Start</div>
            <Countdown
              to={parseInt(String(meme.start_timestamp_ms))}
              class="text-blue-4 justify-evenly text-4xl"
              format="compact"
            />
          </div>
        </div>
        {#if !isExternalMeme}
          <div class="flex justify-center mt-2 border-t border-gray-700">
            <div
              class="i-mdi:chevron-down size-6 text-gray-300 transition-transform duration-200 ease-in-out"
              style="transform: rotate({expanded ? '180deg' : '0deg'})"
            />
          </div>
        {/if}
      </button>
    {:else}
      <button
        class="w-full flex flex-col items-stretch"
        class:cursor-default={isExternalMeme}
        on:click={() => !isExternalMeme && (expanded = !expanded)}
      >
        <div class="flex w-full justify-between items-center">
          {#if meme.end_timestamp_ms && meme.pool_id === null}
            <div class="w-1/2 flex flex-col justify-start items-start">
              <div class="text-gray-400">Remaining Time</div>
              <Countdown
                to={meme.end_timestamp_ms}
                class="text-shitzu-4 justify-evenly text-4xl"
                format="compact"
              />
            </div>
          {/if}
          <div class="flex-shrink-1 w-1/2 flex justify-end h-full">
            <div class="flex flex-col justify-center items-start gap-1 pr-4">
              <div class="text-gray-400">Progress</div>
              <div class="text-2xl font-medium text-memecooking-400">
                {(props.progress * 100).toFixed(2)}%
              </div>
            </div>
            <div class="w-full max-w-25 h-full flex items-center">
              <RadialProgressBar {props} />
            </div>
          </div>
        </div>
        {#if !isExternalMeme}
          <div class="flex justify-center mt-2 border-t border-gray-700">
            <div
              class="i-mdi:chevron-down size-6 text-gray-300 transition-transform duration-200 ease-in-out"
              style="transform: rotate({expanded ? '180deg' : '0deg'})"
            />
          </div>
        {/if}
      </button>
    {/if}
  </div>

  {#if expanded && !isExternalMeme}
    <div class="mb-4" transition:slide={{ duration: 300, easing: quintOut }}>
      <ExtraDetailWithVisual {meme} />
    </div>
  {/if}
</div>
