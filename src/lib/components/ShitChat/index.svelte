<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { match, P } from "ts-pattern";

  import { usePrimaryNftQuery } from "$lib/api/queries/rewarder";
  import SHITZU_WOOF_WOOF from "$lib/assets/static/shitzu_woof_woof.png";
  import { showWalletSelector } from "$lib/auth";
  import { fetchIsLoggedIn, isLoggedIn$ } from "$lib/auth/login";
  import Chatlist from "$lib/components/ShitChat/Chatlist.svelte";
  import type { ShitChatMessage } from "$lib/components/ShitChat/types";
  import { addToast } from "$lib/components/Toast.svelte";
  import { nearWallet } from "$lib/near";

  const { accountId$, walletId$ } = nearWallet;

  // Use the primary NFT query hook
  $: primaryNftQuery = usePrimaryNftQuery($accountId$ || "");

  let messages: ShitChatMessage[] = [];
  let newMessage: string = "";
  let chatContainer: HTMLElement | null = null;
  let socket: WebSocket | null = null;
  let imageFile: File | null = null;
  let imagePreview: string | null = null;
  let onlineUsers: { token_id: string; account_id: string }[] = [];

  function initializeSocket() {
    if (socket) {
      socket.close();
    }

    socket = new WebSocket(
      `${import.meta.env.VITE_MEME_COOKING_API}/shitchat/chat`,
    );

    // socket.addEventListener("open", () => {
    //   console.log("WebSocket connection established");
    //   socket?.send("initial_messages");
    // });

    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "user_status") {
        handleUserStatus(data);
      } else if (data.type === "online_users") {
        onlineUsers = data.users;
      } else {
        const message: ShitChatMessage = data;
        messages = [...messages, message];
        scrollToBottom();
      }
    });

    socket.addEventListener("close", () => {
      console.log("WebSocket connection closed");
    });

    socket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });
  }

  function handleUserStatus(data: {
    token_id: string;
    account_id: string;
    status: "connected" | "disconnected";
  }) {
    if (data.status === "connected") {
      onlineUsers = [
        ...onlineUsers,
        { token_id: data.token_id, account_id: data.account_id },
      ];
    } else {
      onlineUsers = onlineUsers.filter(
        (user) => user.token_id !== data.token_id,
      );
    }
  }

  onMount(async () => {
    await fetchIsLoggedIn();
    initializeSocket();
  });

  onDestroy(() => {
    if (socket) {
      socket.close();
    }
  });

  async function sendMessage() {
    if (!socket) {
      return addToast({
        data: {
          type: "simple",
          data: {
            title: "Login",
            description: "Please login to use ShitChat",
            type: "error",
          },
        },
      });
    }
    if ((newMessage.trim() || imageFile) && $accountId$) {
      let imgUrl = imagePreview || "";

      const message: ShitChatMessage = {
        token_id: $primaryNftQuery.data?.[0] ?? "",
        account_id: $accountId$,
        content: newMessage,
        created_at_ms: Date.now(),
        img: imgUrl || undefined,
      };

      messages = [...messages, message];
      newMessage = "";

      if (imageFile) {
        const formData = new FormData();
        formData.append("imageFile", imageFile);
        imageFile = null;
        imagePreview = null;

        try {
          const { imageCID } = await uploadPromise(formData);
          imgUrl = `${import.meta.env.VITE_IPFS_GATEWAY}/${imageCID}`;

          message.img = imgUrl;
        } catch (error) {
          // Handle error silently
        }
      }

      socket.send(JSON.stringify(message));
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 0);
  }

  async function uploadPromise(formData: FormData) {
    const response = await fetch("/api/create", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Failed to upload image");
    }
    return response.json();
  }

  function removeImage() {
    imageFile = null;
    imagePreview = null;
  }
</script>

<div
  class="flex flex-col h-[calc(100vh-140px)] not-prose text-white w-full py-4"
>
  <div class="flex flex-col flex-1 overflow-y-auto">
    {#await $isLoggedIn$}
      <div class="flex items-center justify-center h-full">
        <div class="i-mdi:loading size-6 animate-spin" />
      </div>
    {:then isLoggedIn}
      {#if isLoggedIn && $primaryNftQuery.data?.[0]}
        <Chatlist
          bind:messages
          currentUser={$primaryNftQuery.data?.[0] ?? ""}
          {onlineUsers}
        />
      {:else}
        <div class="flex flex-col items-center justify-center flex-1 h-full">
          <img src={SHITZU_WOOF_WOOF} class="w-1/2 mb-4" alt="ShitChat" />
          <p class="text-xl mb-4">Shitchat</p>
          <p class="text-lg mb-6 text-center">
            Shitchat is a chill hangout spot <br /> exclusively for Shitzu NFT Revival
            holders.
          </p>
        </div>
      {/if}
    {/await}
  </div>

  <div class="flex flex-col sticky bottom-0 bg-[#222] pt-2">
    {#if imagePreview}
      <div class="relative mb-2 w-fit">
        <img src={imagePreview} alt="Preview" class="max-h-16 rounded-lg" />
        <button
          class="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-red-500 text-white rounded-full p-1"
          on:click={removeImage}
        >
          <div class="i-mdi:close size-4" />
        </button>
      </div>
    {/if}
    {#await $isLoggedIn$}
      <div class="flex items-center">
        <label
          class="bg-lime text-black font-bold text-sm rounded-l-lg px-3 py-2 flex items-center justify-center border-y border-lime cursor-not-allowed opacity-50"
        >
          <input type="file" accept="image/*" class="hidden" disabled />
          <div class="i-mdi:image size-6" />
        </label>

        <input
          type="text"
          value=""
          disabled
          placeholder="Type a message..."
          class="flex-1 bg-black text-white border border-lime px-4 py-2 focus:outline-none opacity-50"
        />

        <button
          class="bg-lime text-black font-bold text-sm rounded-r-lg px-5 py-2 flex items-center justify-center border-y-1 border-r border-lime"
        >
          <div class="i-mdi:loading size-6 animate-spin" />
        </button>
      </div>
    {:then isLoggedIn}
      <div class="flex items-center">
        <input
          type="text"
          bind:value={newMessage}
          disabled={!isLoggedIn || !$accountId$ || !$primaryNftQuery.data?.[0]}
          placeholder="Type a message..."
          class="flex-1 bg-black text-white border border-lime px-4 py-2 focus:outline-none"
          class:opacity-50={!isLoggedIn ||
            !$accountId$ ||
            !$primaryNftQuery.data?.[0]}
          on:keypress={(e) =>
            e.key === "Enter" &&
            isLoggedIn &&
            $accountId$ &&
            $primaryNftQuery.data?.[0] &&
            sendMessage()}
        />

        {#if isLoggedIn && $accountId$ && $primaryNftQuery.data?.[0]}
          <button
            class="bg-lime text-black font-bold text-sm rounded-r-lg px-5 py-2 flex items-center justify-center border-y-1 border-r border-lime"
            on:click={sendMessage}
          >
            <div class="i-mdi:send size-6 mr-2" />
            Send
          </button>
        {:else}
          <button
            class="bg-lime text-black font-bold text-sm rounded-r-lg px-5 py-2 flex items-center justify-center border-y-1 border-r border-lime"
            on:click={async () => {
              if (!$accountId$) {
                return await showWalletSelector();
              }
              const isLoggedIn = await $isLoggedIn$;
              if (!isLoggedIn) {
                const walletId = await $walletId$;
                return match(walletId)
                  .with(P.union("ethereum-wallets"), () => {
                    addToast({
                      data: {
                        type: "simple",
                        data: {
                          title: "Login",
                          description:
                            "This wallet does not yet support replying",
                          type: "error",
                        },
                      },
                    });
                  })
                  .otherwise(async () => {
                    await nearWallet.login();
                    await fetchIsLoggedIn();
                    initializeSocket();
                  });
              }
            }}
          >
            <div class="i-mdi:login size-6 mr-2" />
            Login
          </button>
        {/if}
      </div>
    {/await}
  </div>
</div>
