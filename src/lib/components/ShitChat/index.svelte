<script lang="ts">
  import { onMount } from "svelte";

  import { Button } from "$lib/components";
  import Chatlist from "$lib/components/ShitChat/Chatlist.svelte";

  interface Message {
    id: string;
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
        id: i.toString(),
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
        id: messages.length.toString(),
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
  <Chatlist bind:messages bind:currentUser />

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
