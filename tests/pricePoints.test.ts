import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDayPriceChartData,
  calculatePositivePriceDiff,
  filterValidPricePoints,
  parsePositiveFinitePrice,
} from "../src/lib/util/pricePoints.ts";

test("parsePositiveFinitePrice only accepts finite positive values", () => {
  assert.equal(parsePositiveFinitePrice("0.000001"), 0.000001);
  assert.equal(parsePositiveFinitePrice(1.25), 1.25);

  assert.equal(parsePositiveFinitePrice("0"), null);
  assert.equal(parsePositiveFinitePrice(0), null);
  assert.equal(parsePositiveFinitePrice("-1"), null);
  assert.equal(parsePositiveFinitePrice("Infinity"), null);
  assert.equal(parsePositiveFinitePrice("NaN"), null);
  assert.equal(parsePositiveFinitePrice(""), null);
  assert.equal(parsePositiveFinitePrice(null), null);
  assert.equal(parsePositiveFinitePrice(undefined), null);
});

test("buildDayPriceChartData keeps valid history when current price is unavailable", () => {
  const data = buildDayPriceChartData(
    [
      { price: "0.1", date_time: 100 },
      { price: "0", date_time: 101 },
      { price: "NaN", date_time: 102 },
      { price: "0.2", date_time: 103 },
    ],
    null,
    200_000,
  );

  assert.deepEqual(data, [
    { x: 100_000, y: 0.1 },
    { x: 103_000, y: 0.2 },
  ]);
});

test("buildDayPriceChartData appends current price only when it is valid", () => {
  assert.deepEqual(
    buildDayPriceChartData([{ price: "0.1", date_time: 100 }], "0", 200_000),
    [{ x: 100_000, y: 0.1 }],
  );

  assert.deepEqual(
    buildDayPriceChartData([{ price: "0.1", date_time: 100 }], "0.3", 200_000),
    [
      { x: 100_000, y: 0.1 },
      { x: 200_000, y: 0.3 },
    ],
  );
});

test("calculatePositivePriceDiff requires valid positive current and baseline prices", () => {
  assert.ok(
    Math.abs(calculatePositivePriceDiff("0.12", "0.1")! - 0.2) < Number.EPSILON,
  );
  assert.equal(calculatePositivePriceDiff(null, "0.1"), null);
  assert.equal(calculatePositivePriceDiff("0", "0.1"), null);
  assert.equal(calculatePositivePriceDiff("0.12", "0"), null);
});

test("filterValidPricePoints removes invalid coordinates and non-positive prices", () => {
  assert.deepEqual(
    filterValidPricePoints([
      { x: 1, y: 0.1 },
      { x: 2, y: 0 },
      { x: Number.NaN, y: 0.2 },
      { x: 3, y: Number.POSITIVE_INFINITY },
      { x: 4, y: 0.4 },
    ]),
    [
      { x: 1, y: 0.1 },
      { x: 4, y: 0.4 },
    ],
  );
});
