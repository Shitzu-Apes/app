import type { HereCall } from "@here-wallet/core";
import type { Action, FinalExecutionOutcome } from "@near-wallet-selector/core";
import { get } from "svelte/store";

import type { Meme } from "$lib/models/memecooking";
import { Ft, nearBalance, wallet, type TransactionCallbacks } from "$lib/near";
import { FixedNumber } from "$lib/util";
import { getTokenId } from "$lib/util/getTokenId";

export async function handleBuy(
  input: FixedNumber,
  accountId: string,
  expected: FixedNumber,
  meme: Meme,
  callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
) {
  if (!input || !accountId) return;
  const tokenId = getTokenId(meme.symbol, meme.meme_id);

  // TODO configurable slippage
  const min_amount_out = expected
    .mul(new FixedNumber("95", 2))
    .div(new FixedNumber("100", 2))
    .toU128();

  const transactions: HereCall[] = [];

  const [
    isRegistered,
    storageRequirement,
    wrapNearRegistered,
    wrapNearMinDeposit,
    wrapNearBalance,
  ] = await Promise.all([
    Ft.isUserRegistered(tokenId, accountId),
    Ft.storageRequirement(tokenId),
    Ft.isUserRegistered(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!, accountId),
    Ft.storageRequirement(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!),
    Ft.balanceOf(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!, accountId, 24),
  ]);

  if (!isRegistered) {
    transactions.push({
      receiverId: tokenId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "storage_deposit",
            args: {},
            gas: 20_000_000_000_000n.toString(),
            deposit: storageRequirement,
          },
        },
      ],
    });
  }

  console.log("wnear", wrapNearBalance.format());
  let nearDeposit =
    input.toBigInt() > wrapNearBalance.toBigInt()
      ? input.toBigInt() - wrapNearBalance.toBigInt()
      : 0n;
  if (!wrapNearRegistered) {
    nearDeposit += BigInt(wrapNearMinDeposit);
  }

  const balance = get(nearBalance);
  if (balance && nearDeposit > balance.toBigInt()) {
    console.error("Not enough NEAR balance");
    return;
  }

  const actions: Action[] = [];
  if (nearDeposit > 0n) {
    actions.push({
      type: "FunctionCall",
      params: {
        methodName: "near_deposit",
        args: {},
        gas: 30_000_000_000_000n.toString(),
        deposit: nearDeposit.toString(),
      },
    });
  }
  actions.push({
    type: "FunctionCall",
    params: {
      methodName: "ft_transfer_call",
      args: {
        receiver_id: import.meta.env.VITE_REF_CONTRACT_ID,
        amount: input.toU128(),
        msg: JSON.stringify({
          referral_id:
            import.meta.env.VITE_NETWORK_ID === "mainnet"
              ? "shitzu.sputnik-dao.near"
              : undefined,
          actions: [
            {
              pool_id: meme.pool_id,
              token_in: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
              amount_in: input.toU128(),
              token_out: tokenId,
              min_amount_out,
            },
          ],
        }),
      },
      gas: 150_000_000_000_000n.toString(),
      deposit: "1",
    },
  });

  transactions.push({
    receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
    actions,
  });

  await wallet.signAndSendTransactions({ transactions }, callback);
}

export async function handleSell(
  input: FixedNumber,
  accountId: string,
  expected: FixedNumber,
  meme: Meme,
  unwrapNear: boolean,
  callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
) {
  if (!input || !accountId) return;
  const tokenId = getTokenId(meme.symbol, meme.meme_id);
  const tokenIn = tokenId;
  const tokenOut = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;

  // TODO configurable slippage
  const min_amount_out = expected
    .mul(new FixedNumber("95", 2))
    .div(new FixedNumber("100", 2))
    .toU128();

  const transactions: HereCall[] = [];

  const isWnearRegistered = await Ft.isUserRegistered(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
    accountId,
  );
  if (!isWnearRegistered) {
    const deposit = await Ft.storageRequirement(
      import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
    );
    transactions.push({
      receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
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
  }

  const isRegistered = await Ft.isUserRegistered(tokenId, accountId);
  if (!isRegistered) {
    const deposit = await Ft.storageRequirement(tokenOut);
    transactions.push({
      receiverId: tokenOut,
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
  }

  transactions.push({
    receiverId: tokenIn,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: "ft_transfer_call",
          args: {
            receiver_id: import.meta.env.VITE_REF_CONTRACT_ID,
            amount: input.toU128(),
            msg: JSON.stringify({
              referral_id:
                import.meta.env.VITE_NETWORK_ID === "mainnet"
                  ? "shitzu.sputnik-dao.near"
                  : undefined,
              actions: [
                {
                  pool_id: meme.pool_id,
                  token_in: tokenIn,
                  amount_in: input.toU128(),
                  token_out: tokenOut,
                  min_amount_out,
                },
              ],
              skip_unwrap_near: !unwrapNear,
            }),
          },
          gas: 150_000_000_000_000n.toString(),
          deposit: "1",
        },
      },
    ],
  });

  await wallet.signAndSendTransactions({ transactions }, callback);
}
