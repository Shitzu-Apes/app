<script lang="ts">
  import { BuiltOnNear } from "$lib/assets";
  import GrowthMateAdDekstop from "$lib/components/memecooking/GrowthMate/GrowthMateAdDekstop.svelte";
</script>

<div class="mt-4 w-full space-y-4">
  <div class="max-w-[min(28rem,100%)] px-3 mx-auto">
    <GrowthMateAdDekstop
      unitId="KYbe4YbGrnN89wR359x4fA=="
      format="Small Rectangle"
      network="Near"
      className="rounded-xl mx-auto"
    />
  </div>
  <div class="flex justify-between items-center w-fit mx-auto">
    <div class="flex items-center gap-4">
      <a href="https://near.org/" target="_blank" rel="noopener">
        <BuiltOnNear style="height: 1.1rem;" />
      </a>
      <a href="https://github.com/Shitzu-Apes" target="_blank" rel="noopener">
        <div class="i-simple-icons:github w-[1.1rem] h-[1.1rem]" />
      </a>
      <a href="https://x.com/shitzuonnear" target="_blank" rel="noopener">
        <div class="i-simple-icons:x w-[1.1rem] h-[1.1rem]" />
      </a>
      <a href="https://t.me/Shitzu_Community" target="_blank" rel="noopener">
        <div class="i-simple-icons:telegram w-[1.1rem] h-[1.1rem]" />
      </a>
      <a href="https://shitzuapes.xyz" target="_blank" rel="noopener">
        <div class="i-mdi:web w-[1.3rem] h-[1.3rem]" />
      </a>
    </div>
  </div>
</div>
