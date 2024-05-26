import { view } from "./utils";

export async function isUserRegistered(
  accountId: string,
  tokenId: string,
): Promise<boolean> {
  const storageBalance = await view(tokenId, "storage_balance_of", {
    account_id: accountId,
  });

  return storageBalance != null;
}

export async function storageRequirement(tokenId: string): Promise<string> {
  const storageRequestment = await view(tokenId, "storage_balance_bounds", {});
  return storageRequestment.min;
}
