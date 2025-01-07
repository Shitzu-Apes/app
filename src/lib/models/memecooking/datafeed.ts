// import { subscribeOnStream, unsubscribeFromStream } from "./streaming.js";

import { client, type Meme } from "$lib/api/client";
import { queryClient } from "$lib/api/queries";
import { memesQueryFactory } from "$lib/api/queries/memes";
import type {
  IBasicDataFeed,
  LibrarySymbolInfo,
  ResolutionString,
} from "$lib/charting_library/charting_library";
import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/MCWebSocket";
import { getProjectedMemePriceInNear } from "$lib/util/getProjectedMemePriceInNear";

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

const MemeCookingDataFeed: IBasicDataFeed = {
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
    meme_id,
    onSymbolResolvedCallback,
    onResolveErrorCallback,
  ) => {
    try {
      const cache = queryClient.getQueryCache();
      const memeCache = cache.find(memesQueryFactory.memes.detail(meme_id))
        ?.state.data as { meme: Meme } | null;
      console.log("[resolveSymbol]: Meme", memeCache);
      if (!memeCache) {
        throw new Error("Symbol not found");
      }
      const meme = memeCache.meme;

      const symbolInfo: LibrarySymbolInfo = {
        ticker: meme.symbol,
        name: meme.name,
        description: meme.symbol || "",
        type: "crypto",
        session: "24x7",
        timezone: "Etc/UTC",
        exchange: "MemeCooking",
        minmov: 1e-10,
        pricescale: 100,
        has_intraday: true,
        has_weekly_and_monthly: false,
        supported_resolutions: [
          "1",
          "2",
          "5",
          "15",
          "30",
          "60",
          "120",
        ] as ResolutionString[],
        volume_precision: 5,
        data_status: "streaming",
        listed_exchange: "MemeCooking",
        format: "price",
        logo_urls: meme.image ? [meme.image] : undefined,
        unit_id: meme.meme_id.toString(),
      };

      console.log("[resolveSymbol]: Symbol resolved", meme_id);
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
      console.log("[getBars]: Fetching bars", symbolInfo.unit_id);
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
        noData: true,
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

    let lastBar = lastBarsCache.get(symbolInfo.ticker);

    MCTradeSubscribe(subscriberUID, (data) => {
      console.log("[MCTradeSubscribe]: Data", data);
      console.log("[MCTradeSubscribe]: Data", data.symbol, symbolInfo.ticker);
      if (data.symbol !== symbolInfo.ticker) {
        return;
      }

      if (!lastBar) {
        const time = Math.floor(data.timestamp_ms! / 1000) * 1000;
        lastBar = {
          time,
          low: 0,
          high: 0,
          open: 0,
          close: 0,
        };
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

      const priceInNear = getProjectedMemePriceInNear(data);
      const price = Number(priceInNear) / 1e24;
      console.log("[subscribeBars]: Price", price);
      if (data.timestamp_ms! >= nextBarTime) {
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
    MCunsubscribe(subscriberUID);
  },
};

export default MemeCookingDataFeed;
