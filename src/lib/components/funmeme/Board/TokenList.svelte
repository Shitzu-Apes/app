<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import TokenCarousel from "./TokenCarousel.svelte";

  const tabs = [
    { id: "following", label: "Following" },
    { id: "terminal", label: "Terminal" },
  ];

  const {
    elements: { root, list, content, trigger },
    states: { value },
  } = createTabs({
    defaultValue: "terminal",
  });
</script>

<div use:melt={$root}>
  <div use:melt={$list} class="flex gap-6">
    {#each tabs as tab}
      <button
        use:melt={$trigger(tab.id)}
        class="{tab.id === $value
          ? 'text-shitzu-4 border-current'
          : 'text-gray-4 border-transparent'} border-b-4 font-600"
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <section use:melt={$content("terminal")}>
    <TokenCarousel />
  </section>
  <section use:melt={$content("following")}>Following</section>
</div>
