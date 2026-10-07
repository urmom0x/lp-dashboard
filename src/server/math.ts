// Concentrated-liquidity math shared by Uniswap v3 and Raydium CLMM.
// Floats are fine here: these numbers are for display, not for building transactions.
import type { Chain, Position, Protocol, Token, TokenAmounts } from '../shared/types.ts';

const Q96 = 2 ** 96;
const Q64 = 2 ** 64;

export const sqrtPriceFromTick = (tick: number) => Math.sqrt(1.0001 ** tick);
export const sqrtPriceFromX96 = (x96: bigint) => Number(x96) / Q96;
export const sqrtPriceFromX64 = (x64: bigint) => Number(x64) / Q64;

// Price of token0 denominated in token1, adjusted for decimals.
export const priceFromSqrt = (sqrtP: number, dec0: number, dec1: number) => sqrtP * sqrtP * 10 ** (dec0 - dec1);
export const priceFromTick = (tick: number, dec0: number, dec1: number) => 1.0001 ** tick * 10 ** (dec0 - dec1);

// Token amounts held by a position at the current price.
export function amountsForLiquidity(
  liquidity: bigint, sqrtP: number, tickLower: number, tickUpper: number, dec0: number, dec1: number,
): TokenAmounts {
  const L = Number(liquidity);
  const sa = sqrtPriceFromTick(tickLower);
  const sb = sqrtPriceFromTick(tickUpper);
  let a0 = 0;
  let a1 = 0;
  if (sqrtP <= sa) {
    a0 = (L * (sb - sa)) / (sa * sb);
  } else if (sqrtP >= sb) {
    a1 = L * (sb - sa);
  } else {
    a0 = (L * (sb - sqrtP)) / (sqrtP * sb);
    a1 = L * (sqrtP - sa);
  }
  return { amount0: a0 / 10 ** dec0, amount1: a1 / 10 ** dec1 };
}

export interface PositionInput {
  id: string;
  protocol: Protocol;
  chain: Chain;
  owner: string;
  pool: string;
  feeTier: string | null;
  url: string;
  token0: Token;
  token1: Token;
  tickLower: number;
  tickUpper: number;
  tickCurrent: number;
  sqrtP: number;
  liquidity: bigint;
  fees?: TokenAmounts | null;
}

// Common shape the frontend renders, regardless of which DEX the position came from.
export function buildPosition(input: PositionInput): Position {
  const { token0, token1, tickLower, tickUpper, tickCurrent, sqrtP, liquidity, fees, ...rest } = input;
  return {
    ...rest,
    token0,
    token1,
    tickLower,
    tickUpper,
    tickCurrent,
    priceLower: priceFromTick(tickLower, token0.decimals, token1.decimals),
    priceUpper: priceFromTick(tickUpper, token0.decimals, token1.decimals),
    priceCurrent: priceFromSqrt(sqrtP, token0.decimals, token1.decimals),
    inRange: tickCurrent >= tickLower && tickCurrent < tickUpper,
    rangePosition: (tickCurrent - tickLower) / (tickUpper - tickLower),
    liquidity: liquidity.toString(),
    closed: liquidity === 0n,
    amounts: amountsForLiquidity(liquidity, sqrtP, tickLower, tickUpper, token0.decimals, token1.decimals),
    fees: fees ?? null,
  };
}
