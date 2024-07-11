// import { subscribeOnStream, unsubscribeFromStream } from "./streaming.js";

import type {
  IBasicDataFeed,
  LibrarySymbolInfo,
  ResolutionString,
} from "$lib/charting_library/charting_library";
import {
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
    console.log("[resolveSymbol]: Method call", symbolName);
    try {
      const symbol = await fetch(
        `${import.meta.env.VITE_CLOUDFLARE_WORKER_URL}/api/get_token/${symbolName}`,
      ).then((res) => res.json());

      const symbolInfo: LibrarySymbolInfo = {
        ticker: symbol.ticker,
        name: symbol.name,
        description: symbol.description,
        type: symbol.type,
        session: "24x7",
        timezone: "Etc/UTC",
        exchange: "MemeCooking",
        minmov: 1,
        pricescale: 100,
        has_intraday: true,
        has_weekly_and_monthly: false,
        supported_resolutions: ["1", "5", "15"] as ResolutionString[],
        volume_precision: 2,
        data_status: "streaming",
        listed_exchange: "MemeCooking",
        format: "price",
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
      const data = await fetch(
        `${import.meta.env.VITE_CLOUDFLARE_WORKER_URL}/api/get/${symbolInfo.ticker}/${from}/${to}/${resolution}`,
      ).then((res) => res.json());
      console.log("[getBars]: Data", data);

      const bars: {
        time: number;
        low: number;
        high: number;
        open: number;
        close: number;
      }[] = Object.values(data);

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
    // _resolution,
    // _onRealtimeCallback,
    // _subscriberUID,
  ) => {
    console.log(
      "[subscribeBars]: Method call with subscriberUID:",
      symbolInfo.ticker,
    );

    if (!symbolInfo.ticker) {
      return;
    }

    // const lastBar = lastBarsCache.get(symbolInfo.ticker)!;

    // MCsubscribe(subscriberUID, (data) => {
    //   if (data.ticker !== symbolInfo.ticker) {
    //     return;
    //   }

    //   console.log("[subscribeBar::MCsubscribe]]");
    //   const nextBarTime = lastBar.time + Number(resolution) * 60 * 1000;

    //   let bar: {
    //     time: number;
    //     low: number;
    //     high: number;
    //     open: number;
    //     close: number;
    //   };
    //   const price = parseFloat(data.price);
    //   if (data.timestamp_ms >= nextBarTime) {
    //     console.log("[subscribeBars]: Create new bar");
    //     bar = {
    //       time: nextBarTime,
    //       low: price,
    //       high: price,
    //       open: price,
    //       close: price,
    //     };
    //   } else {
    //     console.log("[subscribeBars]: Update lastBar");
    //     bar = {
    //       ...lastBar,
    //       high: Math.max(lastBar.high, price),
    //       low: Math.min(lastBar.low, price),
    //       close: price,
    //     };
    //   }
    //   lastBar = bar;

    //   onRealtimeCallback(bar);
    // });
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
