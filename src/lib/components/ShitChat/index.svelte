<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import { Button } from "$lib/components";
  import Chatlist from "$lib/components/ShitChat/Chatlist.svelte";
  import { wallet } from "$lib/near";

  interface Message {
    id: string;
    account_id: string;
    content: string;
    created_at_ms: number;
  }

  const { accountId$ } = wallet;

  let messages: Message[] = [];
  let newMessage: string = "";
  let chatContainer: HTMLElement;
  let socket: WebSocket;

  onMount(async () => {
    // Initialize WebSocket connection
    socket = new WebSocket("ws://localhost:8787/shitchat/chat");

    socket.addEventListener("open", () => {
      console.log("WebSocket connection established");
    });

    socket.addEventListener("message", (event) => {
      const message: Message = JSON.parse(event.data);
      // Update messages with the new message from the backend
      messages = [...messages, message];
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

  async function sendMessage() {
    if (newMessage.trim() && $accountId$) {
      const message: Message = {
        id: messages.length.toString(),
        account_id: $accountId$,
        content: newMessage,
        created_at_ms: Date.now(),
      };
      // Send the message to the backend via WebSocket
      socket.send(JSON.stringify(message));
      newMessage = "";
      // The message will be added to 'messages' when received back from the server
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
  {#if $accountId$}
    <Chatlist bind:messages currentUser={$accountId$} />
  {/if}

  <div class="flex items-center sticky bottom-0 bg-[#222] pt-2">
    <input
      type="text"
      bind:value={newMessage}
      placeholder="Type a message..."
      class="flex-1 bg-black text-white border border-lime rounded-l-lg px-4 py-2 focus:outline-none"
      on:keypress={(e) => e.key === "Enter" && sendMessage()}
    />
    <Button
      class="bg-lime text-black font-bold text-sm rounded-r-lg px-5 py-2 flex items-center justify-center"
      onClick={sendMessage}
    >
      <div class="i-mdi:send size-6 mr-2" />
      Send
    </Button>
  </div>
</div>
