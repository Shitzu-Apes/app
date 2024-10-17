<script lang="ts">
  import Terminal from "./Desktop/Terminal.svelte";

  let width: number;
</script>

<svelte:window bind:innerWidth={width} />

<div>
  <Terminal />
</div>
