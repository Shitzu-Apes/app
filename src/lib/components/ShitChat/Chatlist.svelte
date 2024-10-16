<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";
  import { onMount, afterUpdate } from "svelte";

  import type { ShitChatMessage } from "$lib/components/ShitChat/types";
  import Squircle from "$lib/components/Squircle.svelte";

  export let messages: ShitChatMessage[];
  export let currentUser: string;

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
</script>

<div bind:this={chatContainer} class="overflow-y-auto h-full scrollbar-none">
  <div class="flex flex-col justify-end">
    {#each messages as message}
      <div
        class="flex {message.token_id === currentUser
          ? 'justify-end'
          : 'justify-start'} p-2"
      >
        <div
          class="max-w-3/4 bg-gradient-to-r from-lime to-emerald border border-lime rounded-lg p-3"
        >
          <div class="flex items-center mb-1">
            <a
              href={`/shitstars/${message.token_id}`}
              class="flex items-center"
            >
              <Squircle
                src={`${import.meta.env.VITE_NFT_BASE_URL}/${message.token_id}.png`}
                class="size-6 mr-2"
              />
              <span
                class="text-black rounded py-1 text-xs flex-shrink-1 truncate"
              >
                #{message.token_id}
              </span>
            </a>
            <span class="text-xs text-gray-6 ml-2 flex-shrink-0">
              {new Date(message.created_at_ms).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div class="markdown text-black">
            <Markdown source={message.content} />
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .markdown :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
</style>
