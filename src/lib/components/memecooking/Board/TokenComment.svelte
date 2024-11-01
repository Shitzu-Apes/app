<script lang="ts">
  import Markdown from "@magidoc/plugin-svelte-marked";

  import Chef from "../Chef.svelte";

  export let reply: {
    account_id: string;
    id: number;
    content: string;
    created_at_ms: number;
    reply_to_id?: number;
    child_replies:
      | {
          account_id: string;
          id: number;
          content: string;
          created_at_ms: number;
          reply_to_id?: number;
        }[]
      | undefined;
  };
  export let owner: string;
  export let onReplyTo: ((id: string) => void) | undefined = undefined;

  function getColorFromAccountId(accountId: string): string {
    if (accountId === owner) {
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

<div class="w-full flex flex-col p-2 rounded-md text-shitzu-1">
  <div class="flex items-center justify-between gap-1 text-xs text-shitzu-3">
    <Chef
      account={`${reply.account_id}${reply.account_id === owner ? " (dev)" : ""}`}
      class={`${accountColor} text-gray-8 rounded px-1`}
      asLink
    />
    <div class="flex gap-1">
      <div class="text-xs text-shitzu-3">
        #{reply.id}
        {new Date((reply.created_at_ms ?? 0) * 1000).toLocaleString()}
      </div>
    </div>
  </div>
  <div class="markdown text-white mt-1 pl-4">
    <Markdown source={reply.content} />
  </div>
  {#if !reply.reply_to_id}
    <button
      on:click={() => (onReplyTo ? onReplyTo(reply.id.toString()) : undefined)}
      class="flex text-xs text-shitzu-3 pl-4 mt-1 mb-2 w-fit hover:font-bold"
    >
      [reply]
    </button>
  {/if}
  {#if reply.child_replies}
    {#each reply.child_replies as child, index}
      <div class="pl-2 flex">
        <div
          class="w-0.25 bg-shitzu-4 relative {index ===
            reply.child_replies.length - 1 && 'h-4'}"
        >
          <div class="absolute top-4 w-2 h-0.25 bg-shitzu-4"></div>
        </div>
        {#if !reply.reply_to_id}
          <svelte:self reply={child} {owner} />
        {/if}
      </div>
    {/each}
  {/if}
</div>
