<script lang="ts">
  import TabsContent from "./TabsContent.svelte";

  export let initialMemebidsPromise: Promise<void>;
  export let currentMemebidsIdx: number;
</script>

<TabsContent {initialMemebidsPromise} {currentMemebidsIdx} />
