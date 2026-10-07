// The API contract between the server and the dashboard.

export type Chain = 'Ethereum' | 'Solana';
export type Protocol = 'Uniswap v3' | 'Raydium CLMM';

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
}

export interface TokenAmounts {
  amount0: number;
  amount1: number;
}

export interface Position {
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
  /** Prices are token0 denominated in token1, decimal-adjusted. */
  priceLower: number;
  priceUpper: number;
  priceCurrent: number;
  inRange: boolean;
  /** 0 = on the lower edge, 1 = upper edge; outside [0, 1] means out of range. */
  rangePosition: number;
  /** u128 as a decimal string, since JSON can't carry bigint. */
  liquidity: string;
  closed: boolean;
  amounts: TokenAmounts;
  fees: TokenAmounts | null;
}

export interface PositionsResponse {
  positions: Position[];
  errors: string[];
  nearEdgeThreshold: number;
  updatedAt: string;
}
