<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  const benefits = [
    "24/7 Automated Trading",
    "Real-time Market Notifications",
    "Instant Trade Execution",
    "Custom Trading Strategies",
  ];

  let currentBenefit = 0;
  let mounted = false;

  onMount(() => {
    mounted = true;
    setInterval(() => {
      currentBenefit = (currentBenefit + 1) % benefits.length;
    }, 3000);
  });
</script>

<div
  class="relative w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg px-3 py-2 overflow-hidden"
>
  <div class="flex items-center justify-between relative z-10 gap-3">
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <!-- Animated benefits -->
      {#if mounted}
        <div class="overflow-hidden flex-1 min-w-0">
          {#key currentBenefit}
            <p
              class="text-white/90 text-sm truncate"
              in:fade={{ duration: 200 }}
            >
              {benefits[currentBenefit]}
            </p>
          {/key}
        </div>
      {/if}
    </div>

    <a
      href="https://t.me/bettearbot?start=ref-28757995"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition-colors px-3 py-1 rounded-lg text-white whitespace-nowrap text-sm"
    >
      <div class="i-mdi:telegram size-4" />
      Bettear Bot
    </a>
  </div>
</div>

<style>
  @keyframes float {
    0%,
    100% {
      transform: translateY(0) scale(1);
    }
    50% {
      transform: translateY(-10px) scale(1.1);
    }
  }
</style>
