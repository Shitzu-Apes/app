<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { getTokenId } from "$lib/util/getTokenId";

  export let meme: Meme;

  const tokenId = getTokenId(meme.symbol, meme.meme_id);
  const launchDate = new Date(
    (meme.end_timestamp_ms ?? meme.created_timestamp_ms) * 1000,
  ).toLocaleDateString();

  let copied = false;
  let timeoutId: number;

  function copyProposal() {
    const proposalText = `Proposal to Remove Warning Flag for ${meme.name} on Ref Finance

Dear Ref Finance Team,

We are submitting this proposal on behalf of the team behind ${meme.name}, a memecoin that has successfully launched on the meme.cooking platform. We are requesting the removal of the warning flag icon associated with ${meme.name} on your platform, Ref.finance.

Background

${meme.name} was launched on meme.cooking. The project has successfully reached the required soft cap/hard cap and crossed to Ref Finance, meeting all conditions necessary for a verified and secure launch.

Verification

The memecoin has been fully vetted through meme.cooking's secure and transparent launch process, ensuring it adheres to our platform's high standards for token integrity and equitable participation. We believe the warning flag icon is no longer necessary and are confident the token is safe for trading without any additional concerns.

Details

• Token Name: ${meme.name}
• Contract Address: ${tokenId}
• Launch Date: ${launchDate}
• Verified on: meme.cooking

We kindly request the Ref Finance team to review this proposal and remove the warning flag at your earliest convenience, ensuring traders on your platform can participate without hesitation.

Thank you for your support,

The meme.cooking Team
[Contact Information]`;

    navigator.clipboard.writeText(proposalText).then(() => {
      copied = true;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        copied = false;
      }, 2000) as unknown as number;
    });
  }
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Submit Proposal to Ref Finance
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <p>
      To request removal of the warning flag for your token on Ref Finance,
      please submit a proposal using the template below:
    </p>
    <div class="bg-gray-800 pt-4 rounded-md overflow-auto">
      <div class="px-4">
        <h1 class="text-xl font-bold mb-4">
          Proposal to Remove Warning Flag for {meme.name} on Ref Finance
        </h1>

        <p class="mb-4">Dear Ref Finance Team,</p>

        <p class="mb-4">
          We are submitting this proposal on behalf of the team behind {meme.name},
          a memecoin that has successfully launched on the meme.cooking
          platform. We are requesting the removal of the warning flag icon
          associated with {meme.name}
          on your platform, Ref.finance.
        </p>

        <h2 class="text-lg font-semibold mb-2">Background</h2>

        <p class="mb-4">
          {meme.name} was launched on meme.cooking. The project has successfully
          reached the required soft cap/hard cap and crossed to Ref Finance, meeting
          all conditions necessary for a verified and secure launch.
        </p>

        <h2 class="text-lg font-semibold mb-2">Verification</h2>

        <p class="mb-4">
          The memecoin has been fully vetted through meme.cooking's secure and
          transparent launch process, ensuring it adheres to our platform's high
          standards for token integrity and equitable participation. We believe
          the warning flag icon is no longer necessary and are confident the
          token is safe for trading without any additional concerns.
        </p>

        <h2 class="text-lg font-semibold mb-2">Details</h2>

        <ul class="list-disc list-inside mb-4">
          <li><strong>Token Name:</strong> {meme.name}</li>
          <li><strong>Contract Address:</strong> {tokenId}</li>
          <li><strong>Launch Date:</strong> {launchDate}</li>
          <li><strong>Verified on:</strong> meme.cooking</li>
        </ul>

        <p class="mb-4">
          We kindly request the Ref Finance team to review this proposal and
          remove the warning flag at your earliest convenience, ensuring traders
          on your platform can participate without hesitation.
        </p>

        <p class="mb-4">Thank you for your support,</p>

        <p>The meme.cooking Team<br />[Contact Information]</p>
      </div>
      <button
        class="w-full bg-shitzu-4 text-white py-2 rounded-md mt-4 flex items-center justify-center gap-2"
        on:click={copyProposal}
      >
        {#if copied}
          <div class="i-mdi:check" />
        {:else}
          <div class="i-mdi:content-copy" />
        {/if}
        Copy Proposal Template
      </button>
    </div>
    <p>Instructions:</p>
    <ol class="list-decimal list-inside space-y-2">
      <li>Copy the proposal template above</li>
      <li>
        Visit the Ref Finance governance forum at <a
          href="https://gov.ref.finance/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-shitzu-4 hover:underline">https://gov.ref.finance/</a
        >
      </li>
      <li>Create a new proposal thread</li>
      <li>Paste the template and fill in any missing information</li>
      <li>Submit your proposal for review</li>
    </ol>
  </section>
  <button class="w-full text-white hover:font-bold" on:click={closeBottomSheet}>
    [I understand and will submit the proposal]
  </button>
</BottomSheetContent>
