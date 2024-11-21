<script lang="ts">
  import { addToast } from "../../Toast.svelte";
  import XOauthButton from "../../XOauthButton.svelte";

  import { showWalletSelector } from "$lib/auth";
  import { isLoggedIn$ } from "$lib/auth/login";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";

  export let meme: Meme;
  const { accountId$, walletId$ } = wallet;

  let currentStep = 1;
  const totalSteps = 2;

  async function checkOwnership() {
    if (!$accountId$) {
      showWalletSelector("shitzu");
      return;
    }

    const isLoggedIn = await $isLoggedIn$;
    if (!isLoggedIn) {
      const walletId = await $walletId$;
      if (walletId === "ethereum-wallets") {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Login",
              description: "This wallet does not yet support verification",
              color: "red",
            },
          },
        });
        return;
      }
      await wallet.login();
      return;
    }

    if ($accountId$ === meme.owner) {
      currentStep = 2;
    } else {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Unauthorized",
            description: "You must be the owner of this meme to verify it",
            color: "red",
          },
        },
      });
    }
  }
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Twitter Verification
    </h2>
  </slot>

  <section class="text-white px-3 space-y-4 my-10">
    <div class="flex justify-center items-center mb-4">
      {#each Array(totalSteps) as _, index}
        <div class="flex items-center">
          <div
            class={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep > index ? "bg-shitzu-4 text-white" : "bg-gray-300 text-gray-600"}`}
          >
            {index + 1}
          </div>
          {#if index < totalSteps - 1}
            <div
              class={`h-1 w-16 ${currentStep > index ? "bg-shitzu-4" : "bg-gray-300"}`}
            ></div>
          {/if}
        </div>
      {/each}
    </div>

    {#if currentStep === 1}
      <div class="space-y-6">
        <span class="inline-block">
          step 1: <strong class="text-shitzu-4">verify ownership:</strong> confirm
          that you are the owner of this meme
        </span>
        <button
          on:click={checkOwnership}
          class="w-full px-4 py-2 bg-shitzu-4 text-white rounded-lg hover:bg-shitzu-5"
        >
          {$accountId$ ? "Verify Ownership" : "Connect Wallet"}
        </button>
      </div>
    {:else if currentStep === 2}
      <div class="space-y-6">
        <span class="inline-block">
          step 2: <strong class="text-shitzu-4">connect Twitter:</strong> link your
          Twitter account to verify your meme
        </span>
        <XOauthButton {meme} />
      </div>
    {/if}
  </section>

  <button class="w-full text-white hover:font-bold" on:click={closeBottomSheet}>
    [Cancel Verification]
  </button>
</BottomSheetContent>
