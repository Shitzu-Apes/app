<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";

  import type { ShitChatMessage } from "./types";

  import Squircle from "$lib/components/Squircle.svelte";
  import type { FixedNumber } from "$lib/util";

  export let ranking: {
    token_id: string;
    account_id: string;
    score: FixedNumber;
  }[] = [];
  export let message: ShitChatMessage;
  export let currentUser: string;
  export let openShitstarSheet: (token_id: string) => void;

  function isTopTen(token_id: string): boolean {
    return ranking.some((item) => item.token_id === token_id);
  }
</script>

<div
  class="flex {message.token_id === currentUser
    ? 'justify-end'
    : 'justify-start'} p-2"
>
  <div
    class="max-w-3/4 {isTopTen(message.token_id)
      ? 'bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-200'
      : 'bg-gradient-to-r from-lime to-emerald'} rounded-lg p-3"
  >
    <div class="flex items-center mb-1 w-full">
      <button
        class="flex items-center hover:underline text-black gap-1 flex-shrink-1 overflow-hidden"
        on:click={() => openShitstarSheet(message.token_id)}
      >
        <Squircle
          src={`${import.meta.env.VITE_NFT_BASE_URL}/${message.token_id}.png`}
          class="size-6 mr-2 text-white flex-shrink-0"
          stroke={true}
        />
        <div class="text-black rounded py-1 text-xs flex-shrink-0">
          #{message.token_id}
        </div>
        <div class="text-black rounded py-1 text-xs flex-1 truncate">
          ({message.account_id}
        </div>
        <div class="text-black rounded py-1 text-xs flex-shrink-0 -ml-1">)</div>
      </button>
      <span class="text-xs text-gray-6 ml-2 flex-shrink-0">
        {new Date(message.created_at_ms).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
    {#if message.img}
      <img
        src={message.img}
        alt={message.content}
        class="mb-2 rounded-lg max-w-full h-auto"
      />
    {/if}
    <div class="markdown text-black">
      <Markdown source={message.content} />
    </div>
  </div>
</div>

<style>
  .markdown :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
</style>
