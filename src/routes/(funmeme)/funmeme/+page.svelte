<script lang="ts">
  import { BuiltOnNear } from "$lib/assets";
</script>

<div
  class="mx-auto w-fit h-screen flex flex-col justify-center items-center gap-10 overflow-hidden"
>
  <h1
    class="text-6xl md:text-8xl text-center tracking-widest font-semibold text-white animate-shake-x animate-count-infinite px-3"
  >
    Coming <br />Soon
  </h1>
  <a
    href="/"
    class="text-center py-3 rounded-xl text-black animate-duration-1000 font-bold flex items-center justify-center bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald w-40 md:w-60"
  >
    <div class="i-mdi:chevron-left size-6" />
    Back
  </a>

  <div class="mt-6 w-full px-2 py-3 text-white">
    <div class="flex justify-center items-center max-w-lg">
      <div class="flex items-center gap-4">
        <a href="https://near.org/" target="_blank" rel="noopener">
          <BuiltOnNear style="height: 1.1rem;" />
        </a>

        <a href="https://twitter.com/" target="_blank" rel="noopener">
          <div class="i-simple-icons:x w-[1.1rem] h-[1.1rem]" />
        </a>
        <a href="https://t.me/" target="_blank" rel="noopener">
          <div class="i-simple-icons:telegram w-[1.1rem] h-[1.1rem]" />
        </a>
      </div>
    </div>
  </div>
</div>
