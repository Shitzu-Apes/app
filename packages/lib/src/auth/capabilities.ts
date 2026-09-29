import { browser } from "$app/environment";

/**
 * True when this build is being served as meme.cooking.
 *
 * The repo ships two products from one SvelteKit build and tells them apart by
 * hostname, the same way `hooks.server.ts` swaps branding and
 * `(memecooking)/+layout.server.ts` redirects. Product capabilities should
 * follow the same signal rather than a build-time env var, which has to be
 * remembered in every workflow and silently applies to local dev.
 */
export function isMemecookingHost(): boolean {
  return browser && window.location.hostname.includes("meme.cooking");
}

/**
 * Whether to offer EVM wallets.
 *
 * Defaults to off on meme.cooking, which has no EVM flow, and on everywhere
 * else. `VITE_WALLET_SELECTOR_EVM` overrides it when set, so a deployment can
 * still force the choice.
 */
export function shouldShowEvm(isMultichain: boolean): boolean {
  const flag = import.meta.env.VITE_WALLET_SELECTOR_EVM;
  if (flag !== undefined) return flag !== "false";
  if (isMemecookingHost()) return false;
  return isMultichain;
}
