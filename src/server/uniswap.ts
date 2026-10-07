// Uniswap v3 positions on Ethereum mainnet, discovered from the owner's address alone.
import { createPublicClient, getAddress, hexToString, http, parseAbi, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import type { Position, Token, TokenAmounts } from '../shared/types.ts';
import { buildPosition, sqrtPriceFromX96 } from './math.ts';

const POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const MAX_UINT128 = 2n ** 128n - 1n;

const npmAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) returns (uint256 amount0, uint256 amount1)',
]);
const factoryAbi = parseAbi(['function getPool(address, address, uint24) view returns (address)']);
const poolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
]);
const erc20Abi = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);
// A few old tokens (e.g. MKR) return symbol as bytes32 instead of string.
const erc20Bytes32Abi = parseAbi(['function symbol() view returns (bytes32)']);

export type UniswapClient = ReturnType<typeof createUniswapClient>;

const tokenCache = new Map<string, Token>();

export function createUniswapClient(rpcUrl: string) {
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl), batch: { multicall: true } });
}

async function loadTokens(client: UniswapClient, addresses: Address[]) {
  const missing = [...new Set(addresses)].filter((a) => !tokenCache.has(a.toLowerCase()));
  await Promise.all(missing.map(async (address) => {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: 'symbol' })
        .catch(() => client.readContract({ address, abi: erc20Bytes32Abi, functionName: 'symbol' })
          .then((b) => hexToString(b, { size: 32 }).replace(/\0/g, '')))
        .catch(() => `${address.slice(0, 6)}…`),
      client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
    ]);
    tokenCache.set(address.toLowerCase(), { address, symbol, decimals });
  }));
  return (a: Address) => tokenCache.get(a.toLowerCase())!;
}

export async function getUniswapPositions(client: UniswapClient, ownerAddress: string): Promise<Position[]> {
  const owner = getAddress(ownerAddress);
  const count = await client.readContract({
    address: POSITION_MANAGER, abi: npmAbi, functionName: 'balanceOf', args: [owner],
  });

  const tokenIds = await Promise.all(Array.from({ length: Number(count) }, (_, i) =>
    client.readContract({
      address: POSITION_MANAGER, abi: npmAbi, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(i)],
    })));

  const raw = await Promise.all(tokenIds.map(async (tokenId) => {
    const [, , token0, token1, fee, tickLower, tickUpper, liquidity] = await client.readContract({
      address: POSITION_MANAGER, abi: npmAbi, functionName: 'positions', args: [tokenId],
    });
    return { tokenId, token0, token1, fee, tickLower, tickUpper, liquidity };
  }));

  const token = await loadTokens(client, raw.flatMap((p) => [p.token0, p.token1]));

  // One slot0 read per distinct pool.
  type Raw = (typeof raw)[number];
  const poolKey = (p: Raw) => `${p.token0}-${p.token1}-${p.fee}`;
  const pools = new Map<string, { address: Address; sqrtPriceX96: bigint; tick: number }>();
  await Promise.all([...new Map(raw.map((p) => [poolKey(p), p])).values()].map(async (p) => {
    const address = await client.readContract({
      address: FACTORY, abi: factoryAbi, functionName: 'getPool', args: [p.token0, p.token1, p.fee],
    });
    const [sqrtPriceX96, tick] = await client.readContract({ address, abi: poolAbi, functionName: 'slot0' });
    pools.set(poolKey(p), { address, sqrtPriceX96, tick });
  }));

  return Promise.all(raw.map(async (p) => {
    const pool = pools.get(poolKey(p))!;
    const t0 = token(p.token0);
    const t1 = token(p.token1);
    return buildPosition({
      id: p.tokenId.toString(),
      protocol: 'Uniswap v3',
      chain: 'Ethereum',
      owner,
      pool: pool.address,
      feeTier: `${p.fee / 10000}%`,
      url: `https://app.uniswap.org/positions/v3/ethereum/${p.tokenId}`,
      token0: t0,
      token1: t1,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      tickCurrent: pool.tick,
      sqrtP: sqrtPriceFromX96(pool.sqrtPriceX96),
      liquidity: p.liquidity,
      fees: await unclaimedFees(client, owner, p.tokenId, t0, t1),
    });
  }));
}

// Simulating collect() as the owner returns exactly what a claim would pay out right now.
async function unclaimedFees(
  client: UniswapClient, owner: Address, tokenId: bigint, t0: Token, t1: Token,
): Promise<TokenAmounts | null> {
  try {
    const { result: [a0, a1] } = await client.simulateContract({
      address: POSITION_MANAGER, abi: npmAbi, functionName: 'collect', account: owner,
      args: [{ tokenId, recipient: owner, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
    });
    return { amount0: Number(a0) / 10 ** t0.decimals, amount1: Number(a1) / 10 ** t1.decimals };
  } catch {
    return null;
  }
}
