import type {
  Action,
  FinalExecutionOutcome,
  Transaction,
} from "@near-wallet-selector/core";
import { get } from "svelte/store";

import type { Meme } from "$lib/models/memecooking";
import {
  Ft,
  nearBalance,
  Ref,
  nearWallet,
  type TransactionCallbacks,
} from "$lib/near";
import { FixedNumber } from "$lib/util";
import { getTokenId } from "$lib/util/getTokenId";

export async function handleBuy(
  input: FixedNumber,
  accountId: string,
  expected: FixedNumber,
  meme: Meme,
  slippage: number = 0.05,
  callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
) {
  if (!input || !accountId || meme.pool_id == null) return;
  const tokenId = getTokenId(meme);
  const isMainnet = import.meta.env.VITE_NETWORK_ID === "mainnet";

  const slippageFixedNumber = new FixedNumber((slippage * 100).toString(), 2);
  const min_amount_out = expected
    .mul(new FixedNumber("100", 2).sub(slippageFixedNumber))
    .div(new FixedNumber("100", 2))
    .toU128();

  const transactions: Omit<Transaction, "signerId">[] = [];

  const [
    isRegistered,
    storageRequirement,
    wrapNearRegistered,
    wrapNearMinDeposit,
    wrapNearBalance,
    mftIsRegistered,
  ] = await Promise.all([
    Ft.isUserRegistered(tokenId, accountId),
    Ft.storageRequirement(tokenId),
    Ft.isUserRegistered(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!, accountId),
    Ft.storageRequirement(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!),
    Ft.balanceOf(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!, accountId, 24),
    isMainnet
      ? Ref.mftHasRegistered(meme.pool_id, "shitzu.sputnik-dao.near")
      : Promise.resolve(true),
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

  if (!mftIsRegistered) {
    transactions.push({
      receiverId: import.meta.env.VITE_REF_CONTRACT_ID,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "mft_register",
            args: {
              token_id: `:${meme.pool_id}`,
              account_id: "shitzu.sputnik-dao.near",
            },
            gas: 20_000_000_000_000n.toString(),
            deposit: 10_000_000_000_000_000_000_000n.toString(),
          },
        },
      ],
    });
  }

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
          referral_id: isMainnet ? "shitzu.sputnik-dao.near" : undefined,
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

  await nearWallet.signAndSendTransactions({ transactions }, callback);
}

const SHITZU_CONTRACT_ID = import.meta.env.VITE_SHITZU_CONTRACT_ID;

export async function handleSell(
  input: FixedNumber,
  accountId: string,
  expected: FixedNumber,
  meme: Meme,
  unwrapNear: boolean,
  slippage: number = 0.05,
  callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
  shitzuBuy?: {
    amount: FixedNumber;
    nearAmount: FixedNumber;
  },
) {
  if (!input || !accountId || meme.pool_id == null) return;
  const isMainnet = import.meta.env.VITE_NETWORK_ID === "mainnet";
  const tokenId = getTokenId(meme);
  const tokenIn = tokenId;
  const tokenOut = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;

  const slippageFixedNumber = new FixedNumber((slippage * 100).toString(), 2);
  const min_amount_out = expected
    .mul(new FixedNumber("100", 2).sub(slippageFixedNumber))
    .div(new FixedNumber("100", 2))
    .toU128();

  const transactions: Omit<Transaction, "signerId">[] = [];

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

  if (shitzuBuy) {
    const isShitzuRegistered = await Ft.isUserRegistered(
      SHITZU_CONTRACT_ID,
      accountId,
    );
    if (!isShitzuRegistered) {
      const deposit = await Ft.storageRequirement(SHITZU_CONTRACT_ID);
      transactions.push({
        receiverId: SHITZU_CONTRACT_ID,
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

  const mftIsRegistered = isMainnet
    ? await Ref.mftHasRegistered(meme.pool_id, "shitzu.sputnik-dao.near")
    : true;
  if (!mftIsRegistered) {
    transactions.push({
      receiverId: import.meta.env.VITE_REF_CONTRACT_ID,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "mft_register",
            args: {
              token_id: `:${meme.pool_id}`,
              account_id: "shitzu.sputnik-dao.near",
            },
            gas: 20_000_000_000_000n.toString(),
            deposit: 10_000_000_000_000_000_000_000n.toString(),
          },
        },
      ],
    });
  }

  const route = [
    {
      pool_id: meme.pool_id,
      token_in: tokenIn,
      amount_in: input.toU128(),
      token_out: tokenOut,
      min_amount_out,
    },
  ];
  if (shitzuBuy && tokenOut === import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID) {
    route.push({
      pool_id: Number(import.meta.env.VITE_SHITZU_POOL_ID),
      token_in: tokenOut,
      amount_in: shitzuBuy.nearAmount.toU128(),
      token_out: SHITZU_CONTRACT_ID,
      min_amount_out: shitzuBuy.amount.toU128(),
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
              referral_id: isMainnet ? "shitzu.sputnik-dao.near" : undefined,
              actions: route,
              skip_unwrap_near: !unwrapNear,
            }),
          },
          gas: 150_000_000_000_000n.toString(),
          deposit: "1",
        },
      },
    ],
  });

  await nearWallet.signAndSendTransactions({ transactions }, callback);
}
