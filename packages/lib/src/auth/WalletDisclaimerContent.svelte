<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let variant: "lime" | "shitzu" = "lime";
  const dispatch = createEventDispatcher();

  function acceptDisclaimer() {
    dispatch("acceptDisclaimer");
  }

  const textColor = variant === "lime" ? "text-lime" : "text-shitzu-4";
</script>

<section class="text-white px-3 space-y-4 my-10">
  <div class="space-y-6">
    <span class="inline-block">
      <strong class={textColor}>Partial Audit:</strong> Our contract has been partially
      audited. Although steps have been taken to ensure security, not all aspects
      have been fully verified, and unknown risks might exist.
    </span>
    <span class="inline-block">
      <strong class={textColor}>No Endorsement of Tokens:</strong> Our platform is
      a tool for token creation; however, we do not support or endorse any tokens
      created using our services.
    </span>
    <span class="inline-block">
      <strong class={textColor}>Investment Risks:</strong> Investing in tokens involves
      a high degree of risk, including the potential loss of your entire investment.
      You should be prepared financially and emotionally to assume this risk.
    </span>
    <span class="inline-block">
      <strong class={textColor}>Beta Mode:</strong> The platform is currently in
      beta mode, which means you may encounter incomplete features and potential
      bugs that could affect the platform's functionality and your use of it.
    </span>
  </div>
</section>
<p class="text-white px-3 mb-6">
  By continuing to use our platform, you acknowledge that you have read and
  understood this disclaimer, and accept the risks associated with using a
  platform in beta mode, with a partially audited contract, and the potential
  total loss of your investment.
</p>
<p class="text-white px-3 font-bold">Proceed with caution.</p>
<div class="px-3">
  <button
    class="w-full text-black {variant === 'lime'
      ? 'bg-lime hover:bg-lime/80'
      : 'bg-shitzu-4 hover:bg-shitzu-4/80'} font-semibold py-3 rounded-lg transition-colors mt-6 mb-20"
    on:click={acceptDisclaimer}
  >
    I Acknowledge and Accept the Risks
  </button>
</div>
