<script lang="ts">
  import { onMount, afterUpdate } from "svelte";

  import ShitstarSheet from "../ShitstarSheet.svelte";

  import ChatBox from "./ChatBox.svelte";

  import { useRankingQuery } from "$lib/api/queries/ranking";
  import type { ShitChatMessage } from "$lib/components/ShitChat/types";
  import Squircle from "$lib/components/Squircle.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

  export let messages: ShitChatMessage[];
  export let currentUser: string;
  export let onlineUsers: { token_id: string; account_id: string }[] = [];

  // Get ranking data with a reasonable limit
  const ranking = useRankingQuery(100);

  let chatContainer: HTMLElement;
  onMount(() => {
    scrollToBottom();
  });

  afterUpdate(() => {
    scrollToBottom();
  });

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }

  function openShitstarSheet(token_id: string) {
    openBottomSheet(ShitstarSheet, { token_id });
  }
</script>

<div bind:this={chatContainer} class="overflow-y-auto h-full scrollbar-none">
  <div
    class="overflow-x-auto whitespace-nowrap py-2 scrollbar-none border-b border-lime sticky top-0 bg-[#222] px-2"
  >
    <h2 class="text-lg font-300 text-lime mb-2">Online</h2>
    <div class="inline-flex space-x-2">
      {#each onlineUsers as onlineUser (onlineUser.token_id)}
        <button
          class="flex flex-col items-center"
          on:click={() => openShitstarSheet(onlineUser.token_id)}
        >
          <div class="relative">
            <Squircle
              src={`${import.meta.env.VITE_NFT_BASE_URL}/${onlineUser.token_id}.png`}
              class="size-12 text-white"
              stroke={true}
            />
            <div
              class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"
            ></div>
          </div>
          <span class="text-xs text-white mt-1">#{onlineUser.token_id}</span>
        </button>
      {/each}
    </div>
  </div>
  <div class="flex flex-col justify-end">
    {#each messages as message}
      {#if $ranking.isLoading}
        <ChatBox {message} {currentUser} {openShitstarSheet} ranking={[]} />
      {:else if $ranking.data}
        <ChatBox
          {message}
          {currentUser}
          {openShitstarSheet}
          ranking={$ranking.data}
        />
      {:else}
        <ChatBox {message} {currentUser} {openShitstarSheet} ranking={[]} />
      {/if}
    {/each}
  </div>
</div>
