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

// For development/testing - press 'x' to simulate an external trade
if (import.meta.env.DEV) {
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "x") {
      const mockTrade: ExternalTrade = {
        balance_changes: {
          "4illia-222.meme-cooking.near": "21894340425610207581045",
          "wrap.near": "-2962741043865758000000000",
        },
        block_height: 131760021,
        block_timestamp_nanosec: "1730524464624232678",
        receipt_id: Math.random().toString(36).substring(2, 15),
        trader:
          "4051974974926be872126d027c2381f02c1c36a50faf3f21ecca0988344a10b3",
        transaction_id: "8oyNQ65fns3jsLGo3ck4xDrQLNLDN8oZUnDXbeSbL8ZR",
      };

      callbacks.forEach((callback) => {
        callback(mockTrade);
      });
    }
  });
}
