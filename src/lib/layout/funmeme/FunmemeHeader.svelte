<script lang="ts">
  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";
</script>

<nav class="py-2 px-2 w-full flex justify-between">
  <div class="flex gap-4 items-center">
    <a href="/board">
      <img src={SHITZU_FACE} class="size-8 bg-shitzu-4" alt="Shitzu face" />
    </a>
    <ul class="text-sm">
      <div class="flex gap-2">
        <li class="mr-2">
          <a href="https://twitter.com"> [twitter]</a>
        </li>
        <li>
          <a href="https://github.com"> [support]</a>
        </li>
      </div>
      <div class="flex gap-2">
        <li>
          <a href="https://discord.com"> [telegram]</a>
        </li>
        <li>
          <a href="https://discord.com"> [how it works]</a>
        </li>
      </div>
    </ul>
  </div>

  <button class="text-sm"> [connect wallet] </button>
</nav>
