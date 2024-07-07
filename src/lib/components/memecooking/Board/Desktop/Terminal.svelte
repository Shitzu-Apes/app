<script lang="ts">
  import SelectBox from "$lib/components/SelectBox.svelte";

  let sortOptions = [
    { label: "sort: bump order", value: "bump order" },
    { label: "sort: market cap", value: "market cap" },
    { label: "sort: creation time", value: "creation time" },
    { label: "sort: live", value: "live" },
  ];

  let selectedSort = sortOptions[0];

  let orderOptions = [
    { label: "order: asc", value: "asc" },
    { label: "order: desc", value: "desc" },
  ];

  let selectedDirection = orderOptions[0];
</script>

<div class="flex gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
</div>
