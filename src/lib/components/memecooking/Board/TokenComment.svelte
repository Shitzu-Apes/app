<script lang="ts">
  import Chef from "../Chef.svelte";

  export let reply: {
    account_id: string;
    id: number;
    content: string;
    created_at_ms: number;
    is_liked_by_user: boolean;
    likes_count: number;
  };
  export let isDev: boolean;
  export let onLike: (id: number) => Promise<void>;

  let localLikes: number = reply.likes_count;
  let localIsLiked: boolean = reply.is_liked_by_user;
</script>

<div class="w-full flex flex-col gap-2 bg-gray-5 p-2 rounded-md text-shitzu-1">
  <div class="flex items-center gap-1 text-xs text-shitzu-3">
    <Chef
      account={`${reply.account_id}${isDev ? " (dev)" : ""}`}
      class="bg-shitzu-4 text-white rounded px-1"
    />
    <button
      on:click={() => {
        if (!reply.id) return;
        localIsLiked = !localIsLiked;
        localLikes = localIsLiked ? localLikes + 1 : localLikes - 1;
        onLike(reply.id);
      }}
      class="flex items-center gap-1"
    >
      <div
        class={localIsLiked
          ? "i-mdi:heart text-shitzu-4"
          : "i-mdi:heart-outline text-shitzu-4"}
      />
      <div class="text-xs text-shitzu-3">
        {localLikes}
      </div>
    </button>
    <div class="text-xs text-shitzu-3">
      #{reply.id}
      {new Date((reply.created_at_ms ?? 0) * 1000).toLocaleString()}
    </div>
  </div>
  <div>{reply.content}</div>
</div>
