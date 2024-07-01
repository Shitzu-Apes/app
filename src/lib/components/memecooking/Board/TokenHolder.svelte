<script lang="ts">
  let holders = [...new Array(20).keys()];
</script>

<div class="w-full h-full px-4">
  <h2 class="text-xl my-3">Holder</h2>
  <div class="w-full h-full flex flex-col gap-2 items-center">
    {#each holders as holder (holder)}
      <div class="w-full flex justify-between items-center">
        <p>
          {holder + 1}. random
        </p>
        <p>5%</p>
      </div>
    {/each}
  </div>
</div>
