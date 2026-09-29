import { z } from "zod";

import { bumpMeme } from "./memebids";

import { EXTERNAL_MEMES } from "$lib/external_memes";

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
  const ws = new WebSocket("wss://ws-events-v3.intear.tech/events/trade_swap");

  ws.onopen = () => {
    console.log("[ExternalWebsocket] WebSocket connected");
    ws.send(
      JSON.stringify({
        And: [],
      }),
    );
  };

  ws.onerror = (error) => {
    console.error("[ExternalWebsocket] WebSocket error:", error);
  };

  ws.onmessage = (event) => {
    try {
      const data = ExternalTradeSchema.array().parse(JSON.parse(event.data));
      data.forEach((trade) => {
        callbacks.forEach((callback) => {
          callback(trade);
        });
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
    Object.keys(balanceChanges).forEach((token) => {
      if (token.includes("meme-cooking")) {
        const memeId = parseInt(token.split("-")[1]);
        bumpMeme(memeId);
      } else if (EXTERNAL_MEMES.map((meme) => meme?.token_id).includes(token)) {
        // For external memes, find the matching meme and bump using negative index
        const externalMeme = EXTERNAL_MEMES.find(
          (meme) => meme?.token_id === token,
        );
        if (externalMeme) {
          bumpMeme(externalMeme.meme_id);
        }
      }
    });
  } catch (error) {
    console.error("[ExternalWebsocket] Error processing trade:", error);
  }
});
