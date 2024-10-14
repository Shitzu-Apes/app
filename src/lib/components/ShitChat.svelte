<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";
  import { onMount } from "svelte";

  import { Button } from "$lib/components";

  interface Message {
    id: number;
    account_id: string;
    content: string;
    created_at_ms: number;
  }

  let messages: Message[] = [];
  let newMessage: string = "";
  let currentUser: string = "alice.near"; // Replace with actual user authentication
  let chatContainer: HTMLElement;

  onMount(async () => {
    // Fetch initial messages
    messages = await fetchMessages();
    scrollToBottom();
  });

  async function fetchMessages() {
    const mockMessages: Message[] = [];
    const users = [
      "alice.near",
      "bob.near",
      "charlie.near",
      "david.near",
      "eve.near",
    ];
    const contents = [
      "Hello!",
      "How are you?",
      "What's up?",
      "Nice to meet you!",
      "LOL",
      "That's interesting!",
      "I agree",
      "Disagree",
      "Tell me more",
      "Cool!",
      "Awesome!",
      "No way!",
      "Really?",
      "That's crazy!",
      "I'm excited!",
      "Good luck!",
      "Congratulations!",
      "Well done!",
      "That's hilarious!",
      "I'm confused",
      "Can you explain?",
      "Makes sense",
      "I see",
      "Got it",
    ];

    for (let i = 0; i < 1000; i++) {
      mockMessages.push({
        id: i + 1,
        account_id: users[Math.floor(Math.random() * users.length)],
        content: contents[Math.floor(Math.random() * contents.length)],
        created_at_ms: Date.now() - Math.floor(Math.random() * 86400000), // Random time within last 24 hours
      });
    }

    // Sort messages by created_at_ms
    mockMessages.sort((a, b) => a.created_at_ms - b.created_at_ms);

    return mockMessages;
  }

  async function sendMessage() {
    if (newMessage.trim()) {
      const message: Message = {
        id: messages.length + 1,
        account_id: currentUser,
        content: newMessage,
        created_at_ms: Date.now(),
      };
      messages = [...messages, message];
      newMessage = "";
      // Send message to server (replace with actual API call)
      // await sendMessageToServer(message);
      scrollToBottom();
    }
  }

  function getColorFromAccountId(accountId: string): string {
    const colors = [
      "bg-red",
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
  <div
    bind:this={chatContainer}
    class="flex-1 overflow-y-auto gap-4 space-y-4 mb-4 flex flex-col-reverse scrollbar-none"
  >
    {#each messages.slice().reverse() as message (message.id)}
      <div
        class="flex {message.account_id === currentUser
          ? 'justify-end'
          : 'justify-start'}"
      >
        <div
          class="max-w-3/4 bg-gradient-to-r from-lime to-emerald border border-lime rounded-lg p-3"
        >
          <div class="flex items-center mb-1">
            <span
              class="{getColorFromAccountId(
                message.account_id,
              )} text-white rounded px-2 py-1 text-xs"
            >
              {message.account_id}
            </span>
            <span class="text-xs text-gray-6 ml-2">
              {new Date(message.created_at_ms).toLocaleString()}
            </span>
          </div>
          <div class="markdown text-black">
            <Markdown source={message.content} />
          </div>
        </div>
      </div>
    {/each}
  </div>

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

<style>
  .markdown :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
</style>
