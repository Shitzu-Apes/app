<script lang="ts">
  const questions = [
    {
      question: "What is the SHITZU community's staking pool?",
      answer:
        "The SHITZU community runs a validator with a 25% staking fee. This staking pool emits various meme tokens from the NEAR ecosystem, which help subsidize the staking fee.",
    },
    {
      question: "How does the staking fee subsidy work?",
      answer:
        "The staking fee is subsidized by emitting various meme tokens from the NEAR ecosystem. These meme tokens can fluctuate in price, resulting in potentially higher Annual Percentage Rates (APRs) for stakers.",
    },
    {
      question: "What do I receive when I stake with the SHITZU validator?",
      answer:
        "When you stake with the SHITZU validator, you receive a token called $DOGSHIT. This token wraps all the underlying meme tokens emitted by the staking pool.",
    },
    {
      question: "What benefits do I have as an NFT holder?",
      answer:
        "As an NFT holder you receive a 25% boost on all $DOGSHIT claims. The APRs will automatically display the correct APR based on your connected wallet.",
    },
    {
      question: "What is the purpose of the $DOGSHIT token?",
      answer:
        "$DOGSHIT has no other purpose than being burnt to receive the underlying meme tokens. You can burn $DOGSHIT to redeem the meme tokens it represents.",
    },
    {
      question: "How do meme token price fluctuations affect staking?",
      answer:
        "Due to the price fluctuations of the meme tokens emitted by the staking pool, the Annual Percentage Rates (APRs) can be much higher, offering potentially greater rewards for stakers.",
    },
  ];
</script>

<h2>FAQ</h2>
<div>
  {#each questions as faq (faq.question)}
    <details
      class="bg-neutral-800 border border-lime rounded-lg hover:bg-neutral-600 cursor-pointer [&_#chevron]:open:-rotate-180 list-none not-prose py-2 px-2 mb-3"
    >
      <summary class="w-full px-1 list-none marker:hidden">
        <div
          class="flex w-full items-start justify-between text-left text-white"
        >
          <span class="text-base font-semibold text-white">
            {faq.question}
          </span>
          <div
            id="chevron"
            class="ml-6 flex h-7 items-center rotate-0 transform transition-all duration-300 i-mdi:chevron-down w-7"
          />
        </div>
      </summary>
      <p class="px-2 py-3 text-sm text-gray-300 cursor-auto">
        {faq.answer}
      </p>
    </details>
  {/each}
</div>

<style>
  summary::-webkit-details-marker {
    display: none;
  }
</style>
