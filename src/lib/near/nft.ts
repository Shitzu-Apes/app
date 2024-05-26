import { view } from "./utils";

export async function checkNftCount(
  accountId: string,
): Promise<number | undefined> {
  const count = view(
    import.meta.env.VITE_NFT_CONTRACT_ID,
    "nft_supply_for_owner",
    {
      account_id: accountId,
    },
  );

  return count;
}
