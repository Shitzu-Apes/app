<script lang="ts">
  import SelectBox from "$lib/components/SelectBox.svelte";

  let sortOptions = [
    { label: "sort: bump order", value: "bump order" },
    { label: "sort: market cap", value: "market cap" },
    { label: "sort: creation time", value: "creation time" },
    { label: "sort: live", value: "live" },
  ];

  let selectedSort = sortOptions[0];

  let directionOptions = [
    { label: "direction: asc", value: "asc" },
    { label: "direction: desc", value: "desc" },
  ];

  let selectedDirection = directionOptions[0];
</script>

<div class="flex gap-3 mt-6">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={directionOptions} bind:selected={selectedDirection} />
</div>
