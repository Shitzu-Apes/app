<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";
  import { slide } from "svelte/transition";
  import { match, P } from "ts-pattern";

  import { addToast } from "../../Toast.svelte";
  import Chef from "../Chef.svelte";

  import TokenComment from "./TokenComment.svelte";

  import { client, type Reply } from "$lib/api/client";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import SHITZU_WOOF from "$lib/assets/static/shitzu_woof_woof.png";
  import { showWalletSelector } from "$lib/auth";
  import { isLoggedIn$ } from "$lib/auth/login";
  import { Button } from "$lib/components";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { ScreenSize } from "$lib/models";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { screenSize$ } from "$lib/screen-size";

  let reply: string = "";
  let replyToId: string | undefined;
  export let meme: Meme;

  let className: string = "";
  export { className as class };

  const { accountId$, walletId$ } = wallet;

  let scrollContainer: HTMLDivElement;
  let postingReply: boolean = false;

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
      return res.data ?? [];
    });

  function refreshReplies(reply: Reply) {
    replies = replies.then((currentReplies) => {
      return [...currentReplies, reply];
    });
  }

  async function handleReply() {
    if (!$accountId$) {
      showWalletSelector("shitzu");
      return;
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
                description: "This wallet does not yet support replying",
                color: "red",
              },
            },
          });
        })
        .otherwise(wallet.login);
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

    postingReply = true;
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
      .then((response) => {
        // If successful, update the optimistic reply with the actual data
        const actualReply = response.data;
        if (actualReply) {
          // remove the optimistic reply
          postingReply = false;
          refreshReplies({
            ...actualReply,
            id: actualReply.id,
          });
        }
      })
      .catch(async (error) => {
        console.error("Failed to post reply:", error);
        // If failed, remove the optimistic reply
        postingReply = false;
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Error",
              description: "Failed to post reply. Please try again.",
              color: "red",
            },
          },
        });
      })
      .finally(() => {
        reply = "";
        replyToId = undefined;
      });
  }
</script>

<div class="h-full w-full p-2 flex flex-col max-h-full {className}">
  <div
    class="w-full flex flex-col gap-2 text-shitzu-1 mb-6 border-b border-shitzu-3 pb-4"
  >
    <div class="flex items-center justify-between gap-1 text-xs text-shitzu-3">
      <Chef
        account={`${meme.owner} (dev)`}
        class="bg-shitzu-4 text-gray-8 rounded px-1"
        asLink
      />
      <div class="text-xs text-shitzu-3">
        {new Date(meme.created_timestamp_ms ?? 0).toLocaleString()}
      </div>
    </div>
    <div class="w-full flex items-start gap-3">
      <McIcon {meme} class="w-30 rounded-md flex-shrink-0" />
      <div class="flex flex-col items-start flex-1 overflow-hidden">
        <div class="text-sm font-bold">
          {meme.name} ${meme.symbol}
        </div>
        <div
          class="text-sm w-full text-white whitespace-pre-wrap break-words overflow-hidden"
        >
          {meme.description}
        </div>
      </div>
    </div>
  </div>
  {#await replies}
    <div class="w-full flex flex-col p-2 text-shitzu-1">
      <div class="flex justify-center items-center gap-1 text-xs text-shitzu-3">
        <div class="i-svg-spinners:3-dots-fade size-4" />
      </div>
    </div>
  {:then data}
    {#if data.length === 0}
      <div
        class="text-center text-lg text-white flex flex-col items-center justify-center gap-2 my-10"
      >
        <img src={SHITZU_WOOF} class="w-40" alt="No comments found" />
        Be the first to woof woof!
      </div>
    {/if}
    <div class="contents max-h-fit">
      <div
        bind:this={scrollContainer}
        class="w-full flex flex-col gap-2 flex-1 h-0 max-h-[50rem] overflow-auto scrollbar-none py-2"
      >
        {#each data.sort((a, b) => (a.created_at_ms ?? 0) - (b.created_at_ms ?? 0)) as reply}
          <TokenComment
            reply={{
              account_id: reply.account_id,
              id: reply.id ?? 0,
              content: reply.content,
              created_at_ms: reply.created_at_ms ?? 0,
              reply_to_id: reply.reply_to_id ?? undefined,
              child_replies: reply.child_replies?.map((child) => ({
                account_id: child.account_id,
                id: child.id ?? 0,
                content: child.content,
                created_at_ms: child.created_at_ms ?? 0,
                reply_to_id: child.reply_to_id ?? undefined,
              })),
            }}
            owner={meme.owner}
            onReplyTo={async (id) => {
              replyToId = id;
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
                {#if postingReply}
                  <div class="i-svg-spinners:3-dots-fade" />
                {/if}
              </div>
            </div>
            <div class="markdown mt-1 pl-4 text-white">
              <Markdown source={reply} />
            </div>
          </div>
        {/if}
      </div>
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
        {#await $isLoggedIn$}
          <input
            type="text"
            disabled
            class="flex-grow max-w-md p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shitzu-4 text-black max-w-none"
          />
          <Button
            class="ml-2 px-4 py-2 bg-shitzu-4 text-white rounded-lg hover:bg-shitzu-5"
            loading={true}
            type="custom"
          >
            Reply
          </Button>
        {:then isLoggedInResult}
          <input
            type="text"
            disabled={!$accountId$ || !isLoggedInResult}
            bind:value={reply}
            class="flex-grow max-w-md p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shitzu-4 text-black max-w-none"
            on:keydown={async (e) => {
              if (e.key === "Enter") {
                handleReply();
              }
              if (scrollContainer != null) {
                scrollContainer.scrollTo({
                  top: 100_000,
                  behavior: "smooth",
                });
              }
            }}
          />
          <Button
            class="ml-2 px-4 py-2 bg-shitzu-4 text-white rounded-lg hover:bg-shitzu-5"
            onClick={handleReply}
            type="custom"
          >
            {#if !$accountId$}
              Connect
            {:else if isLoggedInResult}
              {#if postingReply}
                <div class="i-svg-spinners:3-dots-fade size-4" />
              {:else}
                Reply
              {/if}
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
  :global(.markdown img) {
    max-height: 20rem;
  }

  :global(.markdown a) {
    color: lightblue;
  }
</style>
