<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import { fetchIsLoggedIn, isLoggedIn$ } from "$lib/auth/login";
  import Chatlist from "$lib/components/ShitChat/Chatlist.svelte";
  import type { ShitChatMessage } from "$lib/components/ShitChat/types";
  import { wallet } from "$lib/near";
  import { resolvedPrimaryNftTokenId, refreshPrimaryNftOf } from "$lib/store";
  const { accountId$ } = wallet;

  let messages: ShitChatMessage[] = [];
  let newMessage: string = "";
  let chatContainer: HTMLElement;
  let socket: WebSocket;

  $: if ($accountId$) {
    refreshPrimaryNftOf($accountId$);
  }

  onMount(async () => {
    fetchIsLoggedIn();
    // Initialize WebSocket connection
    socket = new WebSocket(
      `${import.meta.env.VITE_MEME_COOKING_API}/shitchat/chat`,
    );

    socket.addEventListener("open", () => {
      console.log("WebSocket connection established");
      socket.send("initial_messages");
    });

    socket.addEventListener("message", (event) => {
      const message: ShitChatMessage = JSON.parse(event.data);
      // Update messages with the new message from the backend
      messages = [...messages, message];
      console.log(`[WebSocket message received]`, message);
      scrollToBottom();
    });

    socket.addEventListener("close", () => {
      console.log("WebSocket connection closed");
    });

    socket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  onDestroy(() => {
    // Clean up the WebSocket connection when the component is destroyed
    if (socket) {
      socket.close();
    }
  });

  async function loadMoreMessages() {
    const res = await fetch(
      `${import.meta.env.VITE_MEME_COOKING_API}/shitchat/chat/${messages[0].created_at_ms}`,
      {
        credentials: "include",
      },
    );
    const newMessages = await res.json();
    messages = [...newMessages, ...messages];
  }

  async function sendMessage() {
    if (newMessage.trim() && $accountId$) {
      const message = {
        token_id: $resolvedPrimaryNftTokenId?.token_id ?? "",
        content: newMessage,
        created_at_ms: Date.now(),
      };
      // Send the message to the backend via WebSocket
      socket.send(JSON.stringify(message));
      newMessage = "";
      messages = [...messages, message];
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 0);
  }
</script>

<div
  class="flex-1 flex flex-col max-h-[calc(100vh-182px)] not-prose text-white w-full py-4"
>
  <div class="flex flex-col h-[calc(100vh-182px)]">
    {#await $isLoggedIn$}
      <div class="flex items-center justify-center h-full">
        <div class="i-mdi:loading size-6 animate-spin" />
      </div>
    {:then isLoggedIn}
      {#if isLoggedIn}
        <Chatlist
          bind:messages
          currentUser={$resolvedPrimaryNftTokenId?.token_id ?? ""}
          on:loadMoreMessages={loadMoreMessages}
        />
      {:else}
        <div class="flex flex-col items-center justify-center flex-1 h-full">
          <p class="text-xl mb-4">Welcome to ShitChat!</p>
          <p class="text-lg mb-6">
            You need to log in to join the conversation.
          </p>
          <button
            class="bg-lime text-black font-bold text-sm rounded-lg px-6 py-3 flex items-center justify-center"
            on:click={() => wallet.login()}
          >
            <div class="i-mdi:login size-6 mr-2" />
            Login
          </button>
        </div>
      {/if}
    {/await}
  </div>

  <div class="flex items-center sticky bottom-0 bg-[#222] pt-2">
    <input
      type="text"
      bind:value={newMessage}
      placeholder="Type a message..."
      class="flex-1 bg-black text-white border border-lime rounded-l-lg px-4 py-2 focus:outline-none"
      on:keypress={(e) => e.key === "Enter" && sendMessage()}
    />
    <button
      class="bg-lime text-black font-bold text-sm rounded-r-lg px-5 py-2 flex items-center justify-center"
      on:click={sendMessage}
    >
      <div class="i-mdi:send size-6 mr-2" />
      Send
    </button>
  </div>
</div>
