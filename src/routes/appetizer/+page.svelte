<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";

  import { cubicIn, cubicOut } from "svelte/easing";
  import { blur } from "svelte/transition";

  import MEMECOOKING_LOGO from "$lib/assets/logo/meme-cooking.webp";
</script>

{#key "memecooking"}
  <div
    in:blur={{ duration: 500, delay: 500, easing: cubicIn }}
    out:blur={{ duration: 500, easing: cubicOut }}
    class="w-full h-[100dvh] bg-dark"
  >
    <div
      class="mx-auto w-fit h-full flex flex-col justify-center items-center gap-10 overflow-hidden"
    >
      <h1
        class="text-5xl md:text-7xl text-center tracking-widest font-semibold text-white animate-shake-x animate-count-infinite px-3 flex flex-col items-center motion-reduce:animate-none"
      >
        <img
          src={MEMECOOKING_LOGO}
          alt="memecooking logo"
          class="size-34 md:size-50"
        />
        Testnet <br />Live
      </h1>

      <ul class="text-white">
        {#each ["Staking Price Discovery", "No Presale", "No Dev/Team Allocation", "DEX LP Locked", "0% Loss Pre-DEX Launch"] as item}
          <li class="flex items-center">
            <div class="i-mdi:check-circle size-5 text-shitzu-400 mr-2" />
            {item}
          </li>
        {/each}
      </ul>

      <div class="flex flex-col items-center justify-center gap-3">
        <a href="/board" class="text-white text-xl"> [ Open (testnet) ] </a>
      </div>

      <div class="flex flex-col items-center justify-center gap-3">
        <a
          href="https://shard.dog/memedotcooking"
          target="_blank"
          rel="noopener noreferrer"
          class="text-white text-xl"
        >
          [ Claim ShardDog ]
        </a>
      </div>

      <div class="w-full px-2 py-3 text-white">
        <div class="flex flex-col justify-center items-center max-w-lg gap-2">
          <div class="flex items-center gap-4">
            <a
              href="https://x.com/memedotcooking"
              target="_blank"
              rel="noopener noreferrer"
            >
              [ 𝕏 ]
            </a>
            <a
              href="https://t.me/memedotcooking"
              target="_blank"
              rel="noopener noreferrer"
            >
              [ telegram ]
            </a>
          </div>

          <div class="flex justify-center items-center max-w-lg">
            <a
              href="https://docs.meme.cooking"
              target="_blank"
              rel="noopener noreferrer"
            >
              [ docs ]
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
{/key}
