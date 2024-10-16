<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";
  import { createEventDispatcher, onMount } from "svelte";
  import { VList } from "virtua/svelte";

  export let messages: {
    id: string;
    account_id: string;
    content: string;
    created_at_ms: number;
  }[];
  export let currentUser: string;

  const dispatch = createEventDispatcher();

  let isLoading = false;

  function loadMoreMessages() {
    if (!isLoading) {
      isLoading = true;
      dispatch("loadMoreMessages");
    }
  }

  let vListHandle: VList<{
    id: string;
    account_id: string;
    content: string;
    created_at_ms: number;
  }>;
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

  function getColorFromAccountId(accountId: string): string {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
    ];
    const index =
      accountId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length;
    return colors[index];
  }

  $: {
    if (messages) {
      isLoading = false;
    }
  }
</script>

<div class="flex flex-col h-[calc(100vh-182px)]">
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
          class="flex {message.account_id === currentUser
            ? 'justify-end'
            : 'justify-start'} p-2"
        >
          <div
            class="max-w-3/4 bg-gradient-to-r from-lime to-emerald border border-lime rounded-lg p-3"
          >
            <div class="flex items-center mb-1">
              <span
                class="{getColorFromAccountId(
                  message.account_id,
                )} text-white rounded px-2 py-1 text-xs flex-shrink-1 truncate"
              >
                {message.account_id}
              </span>
              <span class="text-xs text-gray-6 ml-2 flex-shrink-0">
                {new Date(message.created_at_ms).toLocaleString()}
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
</div>

<style>
  .markdown :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
</style>
