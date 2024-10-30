export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const AUCTION_DURATION_MS = 1 * MS_PER_DAY;

export function calculateVestingData(
  vestingDurationMs: number,
  cliffDurationMs: number,
  allocationPercentage: number,
  displayDurationMs: number,
  liquidityPoolPercentage: number,
  depositorPercentage: number,
  circulatingSupplyPercentage: number,
) {
  if (!allocationPercentage) {
    return [];
  }

  const isInstant = vestingDurationMs === 0 && cliffDurationMs === 0;

  // Create data points at key breakpoints
  const points = [];

  // Add auction start point
  points.push({
    time: -AUCTION_DURATION_MS,
    vested: 0,
    liquidityPool: liquidityPoolPercentage,
    depositor: liquidityPoolPercentage + depositorPercentage,
    circulatingSupply: circulatingSupplyPercentage,
  });

  if (isInstant) {
    // For instant vesting, add start and end points with full allocation
    points.push({
      time: 0,
      vested: 0,
      liquidityPool: liquidityPoolPercentage,
      depositor: liquidityPoolPercentage + depositorPercentage,
      circulatingSupply: circulatingSupplyPercentage,
    });

    points.push({
      time: 0,
      vested: allocationPercentage * 100,
      liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
      depositor:
        allocationPercentage * 100 +
        liquidityPoolPercentage +
        depositorPercentage,
      circulatingSupply: circulatingSupplyPercentage,
    });

    points.push({
      time: displayDurationMs,
      vested: allocationPercentage * 100,
      liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
      depositor:
        allocationPercentage * 100 +
        liquidityPoolPercentage +
        depositorPercentage,
      circulatingSupply: circulatingSupplyPercentage,
    });
  } else {
    // Start point at auction end
    points.push({
      time: 0,
      vested: 0,
      liquidityPool: liquidityPoolPercentage,
      depositor: liquidityPoolPercentage + depositorPercentage,
      circulatingSupply: circulatingSupplyPercentage,
    });

    // Add cliff point if there is a cliff
    if (cliffDurationMs > 0) {
      points.push({
        time: cliffDurationMs,
        vested: 0,
        liquidityPool: liquidityPoolPercentage,
        depositor: liquidityPoolPercentage + depositorPercentage,
        circulatingSupply: circulatingSupplyPercentage,
      });
    }

    // Add vesting end point
    points.push({
      time: vestingDurationMs + cliffDurationMs,
      vested: allocationPercentage * 100,
      liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
      depositor:
        allocationPercentage * 100 +
        liquidityPoolPercentage +
        depositorPercentage,
      circulatingSupply: circulatingSupplyPercentage,
    });

    // Add display end point
    points.push({
      time: displayDurationMs,
      vested: allocationPercentage * 100,
      liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
      depositor:
        allocationPercentage * 100 +
        liquidityPoolPercentage +
        depositorPercentage,
      circulatingSupply: circulatingSupplyPercentage,
    });
  }

  return points;
}
