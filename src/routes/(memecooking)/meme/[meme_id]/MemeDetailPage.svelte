<script lang="ts">
  import type { CreateQueryResult } from "@tanstack/svelte-query";

  import MemeDetail from "./MemeDetail.svelte";

  import type { Meme } from "$lib/api/client";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import TokenDetailCarousel from "$lib/components/memecooking/Board/TokenDetailCarousel.svelte";
  import { ScreenSize } from "$lib/models";
  import { screenSize$ } from "$lib/screen-size";

  export let memeDetailQuery: CreateQueryResult<
    {
      meme: Meme;
    } | null,
    Error
  >;
</script>

{#if $memeDetailQuery.isLoading}
  <div class="my-10">
    <LoadingLambo />
  </div>
{:else if $memeDetailQuery.isError}
  <div>Error: {$memeDetailQuery.error.message}</div>
{:else if $memeDetailQuery.data?.meme}
  {#if $screenSize$ > ScreenSize.Tablet}
    <div class="w-full p-2 pb-25">
      <MemeDetail meme={$memeDetailQuery.data.meme} />
    </div>
  {:else}
    <TokenDetailCarousel meme={$memeDetailQuery.data.meme} />
  {/if}
{:else}
  <div>Meme not found</div>
{/if}
