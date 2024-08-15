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

  function getColorFromAccountId(accountId: string): string {
    if (isDev) {
      return "bg-shitzu-4";
    }
    const colors = [
      "bg-red-500",
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

  const accountColor = getColorFromAccountId(reply.account_id);
</script>

<div class="w-full flex flex-col gap-2 bg-gray-5 p-2 rounded-md text-shitzu-1">
  <div class="flex items-center gap-1 text-xs text-shitzu-3">
    <Chef
      account={`${reply.account_id}${isDev ? " (dev)" : ""}`}
      class={`${accountColor} text-gray-8 rounded px-1`}
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
  <div class="text-white">{reply.content}</div>
</div>
