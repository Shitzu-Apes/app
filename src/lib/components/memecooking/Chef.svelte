<script lang="ts">
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";

  export let account: string;

  export let hideAvatar = false;

  let isNamed = account.includes(".");

  let formatName = isNamed
    ? account
    : account.slice(0, 4) + "..." + account.slice(-4);

  let className: string = "";
  export let asLink = false;
  export { className as class };
</script>

<svelte:element
  this={asLink ? "a" : "div"}
  href={asLink ? `/profile/${account.replace(" (dev)", "")}` : undefined}
  class="flex {asLink ? 'hover:font-bold' : ''}"
>
  <div class="flex items-center gap-1 flex-1">
    <slot>
      {#if !hideAvatar}
        <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-4" />
      {/if}
    </slot>
    <span class={className}>{formatName}</span>
  </div>
</svelte:element>
