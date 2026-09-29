<script lang="ts">
  import SHITZU_DETECTIVE from "$lib/assets/static/shitzu_detective.png";
  import { searchQuery$ } from "$lib/store/memebids";
</script>

<div class="relative w-full">
  <input
    type="text"
    class="w-full h-10 pl-10 pr-4 bg-transparent border border-gray-600 text-white rounded focus:border-shitzu-3 focus:outline-none placeholder:text-gray-400"
    placeholder="search for meme"
    bind:value={$searchQuery$}
  />
  <img
    src={SHITZU_DETECTIVE}
    class="absolute size-5 left-3 top-1/2 -translate-y-1/2"
    alt="shitzu detective"
  />
</div>
