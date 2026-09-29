export type PricePoint = {
  x: number;
  y: number;
};

export type HistoryPricePoint = {
  price: string;
  date_time: number;
};

export function parsePositiveFinitePrice(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const price = typeof value === "number" ? value : Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isValidPricePoint(point: PricePoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && point.y > 0;
}

export function filterValidPricePoints(data: PricePoint[]): PricePoint[] {
  return data.filter(isValidPricePoint);
}

export function buildDayPriceChartData(
  priceHistory: HistoryPricePoint[] | null | undefined,
  currentPrice: string | number | null | undefined,
  now = Date.now(),
): PricePoint[] {
  const data =
    priceHistory?.reduce<PricePoint[]>((points, point) => {
      const x = point.date_time * 1000;
      const y = parsePositiveFinitePrice(point.price);

      if (Number.isFinite(x) && y !== null) {
        points.push({ x, y });
      }

      return points;
    }, []) ?? [];

  const validCurrentPrice = parsePositiveFinitePrice(currentPrice);
  if (validCurrentPrice !== null && Number.isFinite(now)) {
    data.push({
      x: now,
      y: validCurrentPrice,
    });
  }

  return data;
}

export function calculatePositivePriceDiff(
  currentPrice: string | number | null | undefined,
  baselinePrice: string | number | null | undefined,
): number | null {
  const current = parsePositiveFinitePrice(currentPrice);
  const baseline = parsePositiveFinitePrice(baselinePrice);

  if (current === null || baseline === null) {
    return null;
  }

  return (current - baseline) / baseline;
}
