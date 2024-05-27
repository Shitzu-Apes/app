<script lang="ts">
  import type { HereCall } from "@here-wallet/core";
  import { createEventDispatcher } from "svelte";
  import { get } from "svelte/store";

  import { Ft, wallet } from "$lib/near";

  const dispatch = createEventDispatcher();

  let className: string | undefined;
  export { className as class };

  async function handleClaimButton() {
    dispatch("claimStart", { loading: true });
    const transactions: HereCall[] = [];
    // const tokenIds = await Promise.all($dogshitContract$
    //   .then((contract) => contract.get_undistributed_rewards(undefined))
    //   .then((rewards) => rewards.map(([tokenId]) => tokenId))
    // );
    const tokenIds = [
      "token.0xshitzu.near",
      "blackdragon.tkn.near",
      "token.lonkingnearbackto2024.near",
      "ndc.tkn.near",
      "avb.tkn.near",
      "intel.tkn.near",
    ];
    const accountId = get(wallet.accountId$);
    if (!accountId) return;
    await Promise.all(
      tokenIds.map(async (tokenId) => {
        const isRegistered = await Ft.isUserRegistered(tokenId, accountId);
        if (isRegistered) return;
        const deposit = await Ft.storageRequirement(tokenId);
        transactions.push({
          receiverId: tokenId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "storage_deposit",
                args: {},
                gas: 20_000_000_000_000n.toString(),
                deposit,
              },
            },
          ],
        });
      }),
    );

    await wallet.signAndSendTransactions(
      {
        transactions: [
          ...transactions,
          {
            receiverId: import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "claim",
                  args: {
                    token_id: import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
                  },
                  gas: 50_000_000_000_000n.toString(),
                  deposit: "1",
                },
              },
            ],
          },
          {
            receiverId: import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "burn",
                  args: {},
                  gas: 250_000_000_000_000n.toString(),
                  deposit: "1",
                },
              },
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

<button class={className} on:click={handleClaimButton}>
  <slot />
</button>
