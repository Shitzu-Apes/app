// import { subscribeOnStream, unsubscribeFromStream } from "./streaming.js";

import { client } from "$lib/api/client";
import type {
  IBasicDataFeed,
  LibrarySymbolInfo,
  ResolutionString,
} from "$lib/charting_library/charting_library";
import {
  MCsubscribe,
  // MCsubscribe
  MCunsubscribe,
} from "$lib/store/memebids";

const lastBarsCache: Map<
  string,
  {
    time: number;
    low: number;
    high: number;
    open: number;
    close: number;
  }
> = new Map();

const createDataFeed: (ws: WebSocket) => IBasicDataFeed = (ws) => ({
  onReady: (callback) => {
    console.log("[onReady]: Method call");
    setTimeout(() => callback({}));
  },

  searchSymbols: async (
    _userInput,
    _exchange,
    _symbolType,
    onResultReadyCallback,
  ) => {
    // console.log("[searchSymbols]: Result", newSymbols);
    onResultReadyCallback([]);
  },

  resolveSymbol: async (
    symbolName,
    onSymbolResolvedCallback,
    onResolveErrorCallback,
  ) => {
    try {
      const symbol = await client.GET("/meme/{id}", {
        params: {
          path: {
            id: symbolName,
          },
        },
      });

      const { data } = symbol;
      console.log("[resolveSymbol]: Symbol", data);
      if (!data) {
        throw new Error("Symbol not found");
      }

      const symbolInfo: LibrarySymbolInfo = {
        ticker: data.meme.symbol,
        name: data.meme.name,
        description: data.meme.description || "",
        type: "crypto",
        session: "24x7",
        timezone: "Etc/UTC",
        exchange: "MemeCooking",
        minmov: 1e-10,
        pricescale: 100,
        has_intraday: true,
        has_weekly_and_monthly: false,
        supported_resolutions: ["1", "5", "15"] as ResolutionString[],
        volume_precision: 5,
        data_status: "streaming",
        listed_exchange: "MemeCooking",
        format: "price",
        logo_urls: data.meme.image ? [data.meme.image] : undefined,
        unit_id: data.meme.meme_id.toString(),
      };

      console.log("[resolveSymbol]: Symbol resolved", symbolName);
      onSymbolResolvedCallback(symbolInfo);
    } catch (err) {
      console.error("[resolveSymbol]: Error resolving symbol", err);
      onResolveErrorCallback("cannot resolve symbol");
      return;
    }
  },

  getBars: async (
    symbolInfo,
    resolution,
    periodParams,
    onHistoryCallback,
    onErrorCallback,
  ) => {
    const { from, to, firstDataRequest } = periodParams;
    console.log(
      "[getBars]: Method call",
      symbolInfo,
      resolution,
      from,
      to,
      firstDataRequest,
      periodParams,
    );

    try {
      if (!symbolInfo.unit_id) {
        throw new Error("Symbol not found");
      }
      const responses = await client.POST("/tradingview/history", {
        body: {
          meme_id: symbolInfo.unit_id,
          from,
          to,
          resolution,
          countBack: periodParams.countBack,
        },
      });
      if (!responses.data) {
        throw new Error("No data returned");
      }
      const bars = responses.data;
      console.log("[getBars]: Bars", bars);

      if (firstDataRequest && symbolInfo.ticker) {
        lastBarsCache.set(symbolInfo.ticker, {
          ...bars[bars.length - 1],
        });
      }
      console.log(`[getBars]: returned ${bars.length} bar(s)`);
      onHistoryCallback(bars, {
        noData: false,
      });
    } catch (error: unknown) {
      console.log("[getBars]: Get error", error);
      onErrorCallback(JSON.stringify(error));
    }
  },

  subscribeBars: (
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscriberUID,
  ) => {
    console.log(
      "[subscribeBars]: Method call with subscriberUID:",
      symbolInfo.ticker,
    );

    if (!symbolInfo.ticker) {
      return;
    }

    let lastBar = lastBarsCache.get(symbolInfo.ticker)!;

    MCsubscribe(subscriberUID, (data) => {
      console.log("[MCsubscribe]: Data", data.symbol, symbolInfo.ticker);
      if (data.symbol !== symbolInfo.ticker) {
        return;
      }

      const nextBarTime = lastBar.time + Number(resolution) * 60 * 1000;

      let bar: {
        time: number;
        low: number;
        high: number;
        open: number;
        close: number;
      };

      if (!data.total_supply || !data.amount) {
        return;
      }

      const total_supply = parseFloat(
        `${data.total_supply.slice(0, -24)}.${data.total_supply.slice(-24)}`,
      );
      const total_deposit = parseFloat(
        `${data.total_deposit.slice(0, -24)}.${data.total_deposit.slice(-24)}`,
      );
      const price = total_deposit / total_supply;

      if (data.timestamp_ms >= nextBarTime) {
        console.log("[subscribeBars]: Create new bar");
        bar = {
          time: nextBarTime,
          low: price,
          high: price,
          open: lastBar.close,
          close: price,
        };
      } else {
        console.log("[subscribeBars]: Update lastBar");
        bar = {
          ...lastBar,
          high: Math.max(lastBar.high, price),
          low: Math.min(lastBar.low, price),
          close: price,
        };
      }
      lastBar = bar;

      onRealtimeCallback(bar);
    });
  },

  unsubscribeBars: (subscriberUID) => {
    console.log(
      "[unsubscribeBars]: Method call with subscriberUID:",
      subscriberUID,
    );
    ws.send(
      JSON.stringify({
        action: "unsubscribe",
      }),
    );
    MCunsubscribe(subscriberUID);
  },
});

export default createDataFeed;
