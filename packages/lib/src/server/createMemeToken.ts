import { KeyPair, connect, keyStores } from "near-api-js";
import type { KeyPairString } from "near-api-js/lib/utils/key_pair";

import {
  PRIVATE_KEY,
  ACCOUNT_ID,
  VITE_NETWORK_ID,
  VITE_NODE_URL,
  VITE_WRAP_NEAR_CONTRACT_ID,
} from "$env/static/private";
import { viewWithNode } from "$lib/near/utils";

const NETWORK_ID = VITE_NETWORK_ID;
const NODE_URL = VITE_NODE_URL;
const WALLET_PRIVATE_KEY = PRIVATE_KEY;

export async function createMemeToken(
  contractId: string,
  params: {
    name: string;
    symbol: string;
    decimals: number;
    durationMs: string;
    totalSupply: string;
    icon: string;
    softCap: string;
    hardCap?: string;
    teamAllocation?: {
      allocationBps: number;
      vestingDurationMs: number;
      cliffDurationMs: number;
    };
    referenceCID: string;
    referenceHash: string;
  },
) {
  const depositTokenId = VITE_WRAP_NEAR_CONTRACT_ID;

  // Connect to NEAR
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(WALLET_PRIVATE_KEY as KeyPairString);
  await keyStore.setKey(NETWORK_ID, ACCOUNT_ID, keyPair);

  const config = {
    networkId: NETWORK_ID,
    keyStore,
    nodeUrl: NODE_URL,
  };

  const near = await connect(config);
  const account = await near.account(ACCOUNT_ID);

  // Calculate storage cost
  console.log("[createMemeToken]: Calculating storage cost", {
    NODE_URL,
    contractId,
    args: {
      sender_id: account.accountId,
      duration_ms: params.durationMs,
      name: params.name,
      symbol: params.symbol,
      icon: params.icon,
      decimals: params.decimals,
      total_supply: params.totalSupply,
      reference: params.referenceCID,
      reference_hash: params.referenceHash,
      deposit_token_id: depositTokenId,
      soft_cap: params.softCap,
      hard_cap: params.hardCap,
    },
  });
  const storageCost = await viewWithNode<string>(
    NODE_URL,
    contractId,
    "create_meme_storage_cost",
    {
      sender_id: account.accountId,
      duration_ms: params.durationMs,
      name: params.name,
      symbol: params.symbol,
      icon: params.icon,
      decimals: params.decimals,
      total_supply: params.totalSupply,
      reference: params.referenceCID,
      reference_hash: params.referenceHash,
      deposit_token_id: depositTokenId,
      soft_cap: params.softCap,
      hard_cap: params.hardCap,
    },
  );

  console.log("Storage cost:", storageCost);
  // Create meme token
  return await account.functionCall({
    contractId,
    methodName: "create_meme",
    args: {
      duration_ms: params.durationMs,
      name: params.name,
      symbol: params.symbol,
      icon: params.icon,
      decimals: params.decimals,
      total_supply: params.totalSupply,
      reference: params.referenceCID,
      reference_hash: params.referenceHash,
      deposit_token_id: depositTokenId,
      soft_cap: params.softCap,
      hard_cap: params.hardCap,
      team_allocation: params.teamAllocation
        ? [
            params.teamAllocation.allocationBps,
            params.teamAllocation.vestingDurationMs,
            params.teamAllocation.cliffDurationMs,
          ]
        : undefined,
    },
    gas: BigInt(250000000000000),
    attachedDeposit: BigInt(storageCost),
  });
}
