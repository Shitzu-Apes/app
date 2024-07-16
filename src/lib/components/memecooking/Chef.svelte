<script lang="ts">
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";

  export let account: string;

  export let hideAvatar = false;

  let isNamed = account.includes(".");

  let formatName = isNamed
    ? account
    : account.slice(0, 4) + "..." + account.slice(-4);

  let className: string = "";
  export { className as class };
</script>

<div class="flex items-center gap-1">
  {#if !hideAvatar}
    <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-4" />
  {/if}
  <span class={className}>{formatName}</span>
</div>
