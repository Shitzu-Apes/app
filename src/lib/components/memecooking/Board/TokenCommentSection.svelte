<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";

  import Chef from "../Chef.svelte";
  import { addToast } from "../Toast.svelte";

  import TokenComment from "./TokenComment.svelte";

  import { replaceState } from "$app/navigation";
  import { client } from "$lib/api/client";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { showWalletSelector } from "$lib/auth";
  import { Button } from "$lib/components";
  import { ScreenSize } from "$lib/models";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { screenSize$ } from "$lib/screen-size";

  let reply: string = "";
  let replyToId: string | undefined;
  export let meme: Meme;

  let className: string = "";
  export { className as class };

  const { accountId$ } = wallet;

  let isLoggedIn: ReturnType<typeof fetchIsLoggedIn> = new Promise<never>(
    () => {},
  );
  let scrollContainer: HTMLDivElement;

  const { walletName$ } = wallet;

  onMount(() => {
    let signedMessage: {
      accountId: string;
      signature: string;
      publicKey: string;
    } | null = null;
    try {
      const url = new URL(window.location.href);
      if (!url.hash) return;
      const accountId = decodeURIComponent(
        url.hash.split("accountId=")[1].split("&")[0],
      );
      const signature = decodeURIComponent(
        url.hash.split("signature=")[1].split("&")[0],
      );
      const publicKey = decodeURIComponent(
        url.hash.split("publicKey=")[1].split("&")[0],
      );
      signedMessage = {
        accountId,
        signature,
        publicKey,
      };

      client
        .GET("/auth/login", {
          params: {
            query: signedMessage,
          },
          credentials: "include",
        })
        .then(() => {
          url.hash = "";
          replaceState(url.toString(), {});
          fetchIsLoggedIn();
        });
    } catch (err) {
      console.error("[TokenCommentSection] Error in login process:", err);
    }
  });

  $: {
    if ($walletName$) {
      $walletName$.then((name) => {
        console.log("[walletName$]", name);
      });
    }
  }

  fetchIsLoggedIn();
  function fetchIsLoggedIn() {
    const res = client
      .GET("/auth/check", {
        credentials: "include",
      })
      .then(({ data }) => data?.isLoggedIn)
      .catch((err) => {
        console.error("[fetchIsLoggedIn]", err);
        return false;
      });
    isLoggedIn = res;
    return res;
  }

  let replies = client
    .GET("/get-replies/replies/{memeId}", {
      params: {
        path: {
          memeId: meme.meme_id.toString(),
        },
      },
      credentials: "include",
    })
    .then((res) => {
      console.log("[replies]", res);
      return res;
    });

  function refreshReplies() {
    replies = client
      .GET("/get-replies/replies/{memeId}", {
        params: {
          path: {
            memeId: meme.meme_id.toString(),
          },
        },
        credentials: "include",
      })
      .then((res) => {
        console.log("[replies]", res);
        return res;
      });
  }

  function handleReply() {
    if (!accountId$) {
      showWalletSelector("shitzu");
      return;
    }
    if (reply.trim() === "") {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Reply cannot be empty",
            description: "Please enter a reply",
            color: "red",
          },
        },
      });
      return;
    }
    if (reply.length > 255) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Reply too long",
            description: "Reply must be less than 255 characters",
            color: "red",
          },
        },
      });
      return;
    }
    client
      .POST("/post-reply/replies", {
        method: "POST",
        body: {
          memeId: meme.meme_id.toString(),
          content: reply,
          replyToId,
        },
        credentials: "include",
      })
      .then(() => {
        reply = "";
        replyToId = undefined;
        refreshReplies();
      });
  }
</script>

<div class="h-full w-full p-2 flex flex-col max-h-full {className}">
  {#await replies}
    <div class="loader size-24" />
  {:then data}
    <div
      bind:this={scrollContainer}
      class="w-full flex flex-col gap-2 flex-1 h-0 overflow-auto noscrollbar"
    >
      <div
        class="w-full flex flex-col gap-2 bg-gray-5 p-2 rounded-md text-shitzu-1"
      >
        <div
          class="flex items-center justify-between gap-1 text-xs text-shitzu-3"
        >
          <Chef
            account={`${meme.owner} (dev)`}
            class="bg-shitzu-4 text-gray-8 rounded px-1"
            asLink
          />
          <div class="text-xs text-shitzu-3">
            {new Date(meme.created_timestamp_ms ?? 0).toLocaleString()}
          </div>
        </div>
        <div class="flex items-start gap-1">
          <img
            src="{import.meta.env.VITE_IPFS_GATEWAY}/{meme.image}"
            class="w-30 rounded-md"
            alt={meme.name}
          />
          <div class="flex flex-col items-start">
            <div class="text-sm font-bold">
              {meme.name} (ticker: {meme.symbol})
            </div>
            <div class="text-sm text-white">{meme.description}</div>
          </div>
        </div>
      </div>
      {#each data.data?.replies ?? [] as reply}
        <TokenComment
          reply={{
            account_id: reply.account_id,
            id: reply.id ?? 0,
            content: reply.content,
            created_at_ms: reply.created_at_ms ?? 0,
            is_liked_by_user: reply.is_liked_by_user,
            likes_count: reply.likes_count,
            reply_to_id: reply.reply_to_id,
            child_replies: reply.child_replies?.map((child) => ({
              account_id: child.account_id,
              id: child.id ?? 0,
              content: child.content,
              created_at_ms: child.created_at_ms ?? 0,
              is_liked_by_user: child.is_liked_by_user ?? false,
              likes_count: child.likes_count ?? 0,
              reply_to_id: child.reply_to_id,
            })),
          }}
          owner={meme.owner}
          onReplyTo={async (id) => {
            replyToId = id;
          }}
          onLike={async (id) => {
            await client.POST("/post-reply/like", {
              body: {
                replyId: id.toString(),
              },
              credentials: "include",
            });
          }}
        />
      {/each}

      {#if reply}
        <div
          out:slide
          in:slide={{ duration: $screenSize$ >= ScreenSize.Laptop ? 300 : 0 }}
          class="w-full flex flex-col bg-gray-5 p-2 rounded-md text-shitzu-1"
        >
          <div class="flex items-center gap-1 text-xs text-shitzu-3">
            <div class="flex flex-1">
              <div class="flex items-center gap-1 flex-1">
                <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-4" />
                <span class="bg-gray-200 text-gray-8 rounded px-1">
                  preview (supports <a
                    class="c-blue-700 inline-flex"
                    href="https://github.github.com/gfm/"
                    target="_blank"
                  >
                    markdown <div class="i-mdi:open-in-new" />
                  </a>)
                </span>
              </div>
            </div>
          </div>
          <div class="markdown mt-1 pl-4 text-white">
            <Markdown source={reply} />
          </div>
        </div>
      {/if}
    </div>
  {/await}

  <div class="w-full flex flex-row gap-2 mt-6 pb-3">
    <div class="w-full flex flex-col items-start">
      {#if replyToId}
        <button
          class="text-xs bg-shitzu-3 text-gray-7 mt-1 mb-2 w-fit flex items-start gap-1 px-2 rounded-full"
          on:click={() => {
            replyToId = undefined;
          }}
        >
          replying to reply #{replyToId}
          <div>x</div>
        </button>
      {/if}
      <div class="w-full flex flex-row">
        <input
          type="text"
          bind:value={reply}
          class="flex-grow max-w-md p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shitzu-4 text-black max-w-none"
          on:keydown={(e) => {
            if (e.key === "Enter") {
              handleReply();
            } else if (scrollContainer != null) {
              scrollContainer.scrollTo({
                top: 100_000,
                behavior: "smooth",
              });
            }
          }}
        />
        {#await isLoggedIn}
          <Button
            class="ml-2 px-4 py-2 bg-shitzu-4 text-white rounded-lg hover:bg-shitzu-5"
            loading={true}
            type="custom"
          >
            Reply
          </Button>
        {:then isLoggedInResult}
          <Button
            class="ml-2 px-4 py-2 bg-shitzu-4 text-white rounded-lg hover:bg-shitzu-5"
            onClick={async () => {
              if (!$accountId$) {
                showWalletSelector("shitzu");
                return;
              } else if (isLoggedInResult) {
                handleReply();
              } else {
                if ((await $walletName$) === "MyNearWallet") {
                  return addToast({
                    data: {
                      type: "simple",
                      data: {
                        title: "Login",
                        description: "Reply from MyNearWallet is not supported",
                        color: "red",
                      },
                    },
                  });
                }
                await wallet.login();
                isLoggedIn = fetchIsLoggedIn();
              }
            }}
            type="custom"
          >
            {#if !$accountId$}
              Connect
            {:else if isLoggedInResult}
              Reply
            {:else}
              Login
            {/if}
          </Button>
        {/await}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  :global(.markdown .markdown-image) {
    max-height: 10rem;
  }

  :global(.markdown a) {
    color: lightblue;
  }
</style>
