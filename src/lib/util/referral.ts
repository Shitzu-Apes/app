import { addToast } from "$lib/components/Toast.svelte";
import type { Meme } from "$lib/models/memecooking";
import { nearWallet } from "$lib/near";
import { MemeCooking } from "$lib/near/memecooking";

export const REFERRAL_LOCALSTORAGE_KEY = "memecooking_referral";
export const REFERRAL_EXPIRY_KEY = "memecooking_referral_expiry";
export const REFERRAL_EXPIRY_TIME = 2 * 7 * 24 * 60 * 60 * 1000; // 2 weeks

export function getReferral() {
  const referral = localStorage.getItem(REFERRAL_LOCALSTORAGE_KEY);
  const expiry = localStorage.getItem(REFERRAL_EXPIRY_KEY);

  if (referral && expiry) {
    const now = Date.now();
    if (now < parseInt(expiry)) {
      return referral;
    } else {
      localStorage.removeItem(REFERRAL_LOCALSTORAGE_KEY);
      localStorage.removeItem(REFERRAL_EXPIRY_KEY);
    }
  }
  return null;
}

export function readAndSetReferral() {
  // read from url
  const url = new URL(window.location.href);
  const referral = url.searchParams.get("referral");
  if (referral) {
    const now = Date.now();
    const expiry = now + REFERRAL_EXPIRY_TIME;
    localStorage.setItem(REFERRAL_LOCALSTORAGE_KEY, referral);
    localStorage.setItem(REFERRAL_EXPIRY_KEY, expiry.toString());
    // Remove the referral search parameter from the URL
    url.searchParams.delete("referral");
    window.history.replaceState({}, document.title, url.toString());
  }
}

export function removeReferral() {
  localStorage.removeItem(REFERRAL_LOCALSTORAGE_KEY);
  localStorage.removeItem(REFERRAL_EXPIRY_KEY);
}

export async function shareWithReferral($accountId$?: string, meme?: Meme) {
  const shareUrl =
    meme != null
      ? new URL(`${window.location.origin}/meme/${meme.meme_id}`)
      : new URL(window.location.origin);
  if ($accountId$) {
    const [storageBalance, { account: accountCost, perMemeDeposit }] =
      await Promise.all([
        MemeCooking.storageBalanceOf($accountId$),
        MemeCooking.storageCosts(),
      ]);
    const isRegistered = storageBalance != null;
    if (!isRegistered) {
      await nearWallet.signAndSendTransaction(
        {
          receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "storage_deposit",
                args: {},
                gas: 30_000_000_000_000n.toString(),
                deposit: (
                  BigInt(accountCost) +
                  5n * BigInt(perMemeDeposit)
                ).toString(),
              },
            },
          ],
        },
        {},
      );
    }
    shareUrl.searchParams.set("referral", $accountId$);
  }

  setTimeout(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Success",
            description:
              $accountId$ != null
                ? "Link with referral copied!"
                : "Link copied (need to register for referrals)",
            type: "success",
          },
        },
      });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  });
}
