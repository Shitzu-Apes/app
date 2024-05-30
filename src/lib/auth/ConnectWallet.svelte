<script lang="ts">
  import { showWalletSelector } from "./showWalletSelector";

  import { Button } from "$lib/components";
  import { wallet } from "$lib/near";
</script>

<Button
  class="w-full py-3"
  onClick={wallet.isTG ? wallet.loginViaHere : showWalletSelector}
>
  Connect Wallet
</Button>
