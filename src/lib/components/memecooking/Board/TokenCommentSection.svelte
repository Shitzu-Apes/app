<script lang="ts">
  import TokenComment from "./TokenComment.svelte";

  import { client } from "$lib/api/client";

  let reply: string = "";
  export let id: number;
  export let creator: string;

  let replies = client
    .GET("/get-replies/replies/{memeId}", {
      params: {
        path: {
          memeId: id.toString(),
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
            memeId: id.toString(),
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
    client
      .POST("/post-reply/replies", {
        method: "POST",
        body: {
          memeId: id.toString(),
          content: reply,
        },
        credentials: "include",
      })
      .then(() => {
        reply = "";
        refreshReplies();
      });
  }
</script>

<div class="h-full w-full max-w-[500px]">
  {#await replies}
    <div class="loader size-24" />
  {:then data}
    <div class="w-full flex flex-col gap-2">
      {#each data.data?.replies ?? [] as reply}
        <TokenComment
          reply={{
            account_id: reply.account_id,
            id: reply.id ?? 0,
            content: reply.content,
            created_at_ms: reply.created_at_ms ?? 0,
            is_liked_by_user: reply.is_liked_by_user,
            likes_count: reply.likes_count,
          }}
          isDev={reply.account_id === creator}
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
    <input
      type="text"
      bind:value={reply}
      class="w-full max-w-md p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-shitzu-4 text-black"
      on:keydown={(e) => {
        if (e.key === "Enter") {
          handleReply();
        }
      }}
    />
    <button
      class="ml-2 px-4 py-2 bg-shitzu-4 text-white rounded-lg hover:bg-shitzu-5"
      on:click={() => {
        handleReply();
      }}
    >
      Reply
    </button>
  </div>
</div>
