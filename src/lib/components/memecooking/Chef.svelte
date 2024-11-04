<script lang="ts">
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";

  export let account: string;

  export let hideAvatar = false;

  $: isNamed = account.includes(".");

  $: formatName = isNamed
    ? account
    : account.slice(0, 4) + "..." + account.slice(-4);

  let className: string = "";
  export let asLink = false;
  export { className as class };
</script>

<svelte:element
  this={asLink ? "a" : "div"}
  href={asLink ? `/profile/${account.replace(" (dev)", "")}` : undefined}
  class="w-full flex flex-1 overflow-hidden text-ellipsis {asLink
    ? 'hover:underline hover:text-shitzu-3'
    : ''}"
>
  <div class="w-full flex items-center gap-1 flex-1">
    <slot>
      {#if !hideAvatar}
        <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-4" />
      {/if}
    </slot>
    <span class="overflow-hidden text-ellipsis {className}">{formatName}</span>
  </div>
</svelte:element>
