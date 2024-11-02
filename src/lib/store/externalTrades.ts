import { z } from "zod";

import { bumpMeme } from "./memebids";

const ExternalTradeSchema = z.object({
  balance_changes: z.record(z.string(), z.string()),
  block_height: z.number(),
  block_timestamp_nanosec: z.string(),
  receipt_id: z.string(),
  trader: z.string(),
  transaction_id: z.string(),
});

export type ExternalTrade = z.infer<typeof ExternalTradeSchema>;

const callbacks: Map<string | symbol, (data: ExternalTrade) => void> =
  new Map();

export function initializeExternalWebsocket() {
  const ws = new WebSocket("wss://ws-events.intear.tech/events/trade_swap");

  ws.onopen = () => {
    console.log("[ExternalWebsocket] WebSocket connected");
    ws.send("{}");
  };

  ws.onerror = (error) => {
    console.error("[ExternalWebsocket] WebSocket error:", error);
  };

  ws.onmessage = (event) => {
    try {
      const data = ExternalTradeSchema.parse(JSON.parse(event.data));
      callbacks.forEach((callback) => {
        callback(data);
      });
    } catch (error) {
      console.error("[ExternalWebsocket] Error parsing message:", error);
    }
  };

  ws.onclose = () => {
    console.log("[ExternalWebsocket] WebSocket closed");
    // Attempt to reconnect after delay
    setTimeout(() => {
      console.log("[ExternalWebsocket] Attempting to reconnect...");
      initializeExternalWebsocket();
    }, 5000);
  };

  return ws;
}

export function EXTTradeSubscribe(
  id: string | symbol,
  callback: (data: ExternalTrade) => void,
) {
  callbacks.set(id, callback);
}

export function EXTunsubscribe(id: string | symbol) {
  callbacks.delete(id);
}

EXTTradeSubscribe(Symbol("external_feed"), async (data) => {
  try {
    const balanceChanges = data.balance_changes;
    const relevantToken = Object.keys(balanceChanges).find((token) =>
      token.includes("meme-cooking"),
    );

    if (relevantToken) {
      const memeId = parseInt(relevantToken.split("-")[1]);
      bumpMeme(memeId);
    }
  } catch (error) {
    console.error("[ExternalWebsocket] Error processing trade:", error);
  }
});
