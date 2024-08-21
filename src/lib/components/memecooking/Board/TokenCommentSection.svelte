<script lang="ts">
  import Chef from "../Chef.svelte";
  import { addToast } from "../Toast.svelte";

  import TokenComment from "./TokenComment.svelte";

  import { client } from "$lib/api/client";
  import { showWalletSelector } from "$lib/auth";
  import { Button } from "$lib/components";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";

  let reply: string = "";
  let replyToId: string | undefined;
  export let meme: Meme;

  const { accountId$ } = wallet;

  let isLoggedIn: ReturnType<typeof fetchIsLoggedIn> = new Promise<never>(
    () => {},
  );

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

<div class="h-full w-full">
  {#await replies}
    <div class="loader size-24" />
  {:then data}
    <div class="w-full flex flex-col gap-2">
      <div
        class="w-full flex flex-col gap-2 bg-gray-5 p-2 rounded-md text-shitzu-1"
      >
        <div
          class="flex items-center justify-between gap-1 text-xs text-shitzu-3"
        >
          <Chef
            account={`${meme.owner} (dev)`}
            class="bg-shitzu-4 text-gray-8 rounded px-1"
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
            <div class="text-sm font-bold">{meme.name} ({meme.symbol})</div>
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
    </div>
  {/await}

  <div class="w-full flex flex-row gap-2 mt-6">
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
