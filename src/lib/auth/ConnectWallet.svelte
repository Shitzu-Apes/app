<script lang="ts">
  import { showWalletSelector } from "./showWalletSelector";

  import { wallet } from "$lib/near";
</script>

<button
  class="w-full py-3 bg-lime text-black rounded-xl mt-3 text-lg font-bold"
  on:click={wallet.isTG ? wallet.loginViaHere : showWalletSelector}
>
  Connect Wallet
</button>
