<script lang="ts">
  export let steps: {
    text: string;
    href?: string;
    linkText?: string;
  }[] = [];

  let className: string = "";
  export { className as class };
</script>

<ol class="relative border-l border-gray-600 ml-4 {className}">
  {#each steps as { text, href, linkText }, i}
    <li class="mb-6 ml-6">
      <span
        class="absolute flex items-center justify-center w-6 h-6 bg-gray-800 rounded-full -left-3 border border-gray-600"
      >
        {i + 1}
      </span>
      <div class="flex flex-col">
        <span>{text}</span>
        {#if href && linkText}
          <a
            {href}
            target="_blank"
            rel="noopener noreferrer"
            class="bg-memecooking-3 px-1 py-0.5 rounded-md text-black hover:bg-memecooking-4 text-sm w-fit flex items-center gap-2"
          >
            {linkText}
            <div class="i-mdi:tray-arrow-up w-4 h-4" />
          </a>
        {/if}
      </div>
    </li>
  {/each}
</ol>
