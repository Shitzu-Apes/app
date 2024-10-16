<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";
  import { createEventDispatcher, onMount } from "svelte";
  import { VList } from "virtua/svelte";

  import type { ShitChatMessage } from "$lib/components/ShitChat/types";
  import Squircle from "$lib/components/Squircle.svelte";
  import { timesAgo } from "$lib/util/timesAgo";

  export let messages: ShitChatMessage[];
  export let currentUser: string;

  const dispatch = createEventDispatcher();

  let isLoading = false;

  function loadMoreMessages() {
    if (!isLoading) {
      isLoading = true;
      dispatch("loadMoreMessages");
    }
  }

  let vListHandle: VList<ShitChatMessage>;
  let shouldStickToBottom = true;
  let isPrepend = false;

  onMount(() => {
    scrollToBottom();
  });

  function scrollToBottom() {
    if (vListHandle && shouldStickToBottom) {
      vListHandle.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }

  function handleScroll(offset: number) {
    if (!vListHandle) return;
    const scrollSize = vListHandle.getScrollSize();
    const viewportSize = vListHandle.getViewportSize();
    const maxScroll = scrollSize - viewportSize;

    shouldStickToBottom = maxScroll - offset <= 1;

    if (offset < 100) {
      isPrepend = true;
      loadMoreMessages();
    } else {
      isPrepend = true;
    }
  }

  $: {
    if (messages) {
      isLoading = false;
    }
  }
</script>

<div
  class="overflow-y-auto h-[calc(100vh-182px)]"
  style="display: block; overflow-y: auto; contain: strict; width: 100%; height: 100%;"
>
  <div class="flex flex-col justify-end overflow-y-auto h-full">
    <VList
      bind:this={vListHandle}
      data={messages}
      let:item={message}
      on:scroll={(e) => handleScroll(e.detail)}
      class="scrollbar-none"
      shift={isPrepend}
    >
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
              {timesAgo(new Date(message.created_at_ms))}
            </span>
          </div>
          <div class="markdown text-black">
            <Markdown source={message.content} />
          </div>
        </div>
      </div>
    </VList>
  </div>
</div>

<style>
  .markdown :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
</style>
