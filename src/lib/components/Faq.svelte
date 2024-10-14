<script lang="ts">
  export let qnas: { question: string; answer: string }[] = [];
</script>

<h2>FAQ</h2>
<div>
  {#each qnas as qna (qna.question)}
    <details
      class="bg-black border border-lime rounded-lg cursor-pointer [&_#chevron]:open:-rotate-180 list-none not-prose py-2 px-2 mb-3"
    >
      <summary
        class="w-full px-1 list-none marker:hidden transition duration-150 transition-ease-out"
      >
        <div
          class="flex w-full items-start justify-between text-left text-white"
        >
          <span class="text-base font-semibold text-white">
            {qna.question}
          </span>
          <div
            id="chevron"
            class="ml-6 flex h-7 items-center rotate-0 transform transition-all duration-300 i-mdi:chevron-down w-7"
          />
        </div>
      </summary>
      <p class="px-2 py-3 text-sm text-gray-300 cursor-auto">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html qna.answer}
      </p>
    </details>
  {/each}
</div>

<style>
  summary::-webkit-details-marker {
    display: none;
  }

  details summary {
    transition: margin 150ms ease-out;
  }

  details[open] summary {
    margin-bottom: 0.75rem;
  }
</style>
