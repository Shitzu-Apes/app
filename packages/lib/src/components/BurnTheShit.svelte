<script lang="ts">
  import { actionCreators } from "@near-wallet-selector/core";
  import type { Transaction } from "@near-wallet-selector/core";
  import { createEventDispatcher } from "svelte";
  import { get } from "svelte/store";

  import Button from "./Button.svelte";

  import { Dogshit, Ft, nearWallet } from "$lib/near";

  const dispatch = createEventDispatcher();

  let className: string | undefined;
  export { className as class };

  async function handleClaimButton() {
    dispatch("claimStart", { loading: true });
    const transactions: Omit<Transaction, "signerId">[] = [];
    const tokenIds = await Dogshit.getUndistributedRewards().then((rewards) =>
      rewards.map(([tokenId]) => tokenId),
    );
    const accountId = get(nearWallet.accountId$);
    if (!accountId) return;
    await Promise.all(
      tokenIds.map(async (tokenId) => {
        const isRegistered = await Ft.isUserRegistered(tokenId, accountId);
        if (isRegistered) return;
        const deposit = await Ft.storageRequirement(tokenId);
        transactions.push({
          receiverId: tokenId,
          actions: [
            actionCreators.functionCall(
              "storage_deposit",
              {},
              20_000_000_000_000n,
              BigInt(deposit),
            ),
          ],
        });
      }),
    );

    await nearWallet.signAndSendTransactions(
      {
        transactions: [
          ...transactions,
          {
            receiverId: import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
            actions: [
              actionCreators.functionCall(
                "claim",
                {
                  token_id: import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
                },
                50_000_000_000_000n,
                1n,
              ),
            ],
          },
          {
            receiverId: import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
            actions: [
              actionCreators.functionCall("burn", {}, 250_000_000_000_000n, 1n),
            ],
          },
        ],
      },
      {
        onSuccess: () => {
          dispatch("claimSuccess", { loading: false });
        },
        onFinally: () => {
          dispatch("claimEnd", { loading: false });
        },
      },
    );
  }
</script>

<Button class={className} onClick={handleClaimButton}>
  <slot />
</Button>
