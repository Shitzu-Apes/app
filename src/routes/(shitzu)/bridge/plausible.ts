import type { Transfer } from "omni-bridge-sdk";
import { get } from "svelte/store";

import { bridgePortfolio$ } from "./portfolio";
import { findTokenByAddress, TOKENS } from "./tokens";
import { getTokenPrice } from "./utils";

import { FixedNumber } from "$lib/util";

type PlausibleEvent = {
  name: string;
  domain: string;
  url: string;
  props: {
    token: string;
    source_network: "Eth" | "Near" | "Sol" | "Arb" | "Base";
    destination_network: string;
    amount: string;
  };
  revenue?: {
    currency: string;
    amount: string;
  };
};

// Map chain names to network names used in token decimals
function getNetworkFromChain(
  chain: "Eth" | "Near" | "Sol" | "Arb" | "Base",
): keyof (typeof TOKENS)[keyof typeof TOKENS]["decimals"] {
  switch (chain) {
    case "Eth":
      return "ethereum";
    case "Near":
      return "near";
    case "Sol":
      return "solana";
    case "Arb":
      return "arbitrum";
    case "Base":
      return "base";
  }
}

export async function trackBridgeTransfer(transfer: Transfer) {
  try {
    const amount = transfer.transfer_message?.amount;
    if (!amount) return;

    // Get token info
    const tokenKey = findTokenByAddress(
      transfer.id.origin_chain,
      transfer.transfer_message.token,
    );

    // Get USD value from portfolio if available
    const portfolio = get(bridgePortfolio$);

    const tokenPrice =
      tokenKey && portfolio.prices
        ? getTokenPrice(tokenKey, portfolio.prices)
        : null;

    const domain =
      import.meta.env.VITE_PLAUSIBLE_DOMAIN || window.location.hostname;
    const url = new URL(
      window.location.pathname + window.location.search,
      `https://${domain}`,
    ).toString();

    const network = getNetworkFromChain(transfer.id.origin_chain);
    const decimals = tokenKey ? (TOKENS[tokenKey].decimals[network] ?? 18) : 18;

    const eventData: PlausibleEvent = {
      name: "bridge_transfer",
      domain,
      url,
      props: {
        token: transfer.transfer_message.token,
        source_network: transfer.id.origin_chain,
        destination_network: transfer.transfer_message.recipient.split(":")[0],
        amount: new FixedNumber(amount.toString(), decimals).toString(),
      },
    };

    // Add USD value as revenue if available
    if (tokenPrice) {
      const amountNum = new FixedNumber(amount.toString(), decimals).toNumber();
      const usdAmount = Math.round(amountNum * tokenPrice * 100) / 100;
      eventData.revenue = {
        currency: "USD",
        amount: usdAmount.toString(),
      };
    }
    console.log("[eventData]", eventData);

    // Send event to Plausible
    await fetch("https://plausible.io/api/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });
  } catch (error) {
    console.error("Failed to track bridge transfer:", error);
  }
}
