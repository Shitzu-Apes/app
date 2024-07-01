<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import TokenCarousel from "./TokenCarousel.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { MemeCooking } from "$lib/near";
  import { memebids } from "$lib/store/memebids";

  export let currentMemebidsIdx: number;

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

  MemeCooking.subscribeToMemeUpdates((newMemeInfo) => {
    const idx = $memebids.findIndex((b) => b.id === newMemeInfo.id);

    if (idx === currentMemebidsIdx) {
      return;
    }

    if (idx === -1) {
      $memebids = [...$memebids, newMemeInfo];
    }
  });

  async function onSelect(event: CustomEvent<number>) {
    const idx = event.detail;
    currentMemebidsIdx = idx;
    if (idx === -1) {
      replaceState("/board", $page.state);
      return;
    }

    const id = $memebids[idx].id;

    if (!id) return;

    replaceState(`/${id}`, $page.state);
  }
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
    <TokenCarousel
      memebids={$memebids}
      {currentMemebidsIdx}
      on:select={onSelect}
    />
  </section>
  <section use:melt={$content("following")}>Following</section>
</div>
