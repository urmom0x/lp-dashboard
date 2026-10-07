// Raydium CLMM positions on Solana, discovered from the owner's address alone.
// Each CLMM position is an NFT held by the wallet; its state lives in a PDA seeded by the NFT mint.
import { Connection, PublicKey, type AccountInfo } from '@solana/web3.js';
import type { Position } from '../shared/types.ts';
import { buildPosition, sqrtPriceFromX64 } from './math.ts';

const CLMM_PROGRAM = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const RAYDIUM_MINT_API = 'https://api-v3.raydium.io/mint/ids?mints=';

const symbolCache = new Map<string, string>();

export function createSolanaConnection(rpcUrl: string) {
  return new Connection(rpcUrl, 'confirmed');
}

const readU128 = (buf: Buffer, off: number) => buf.readBigUInt64LE(off) + (buf.readBigUInt64LE(off + 8) << 64n);
const readKey = (buf: Buffer, off: number) => new PublicKey(buf.subarray(off, off + 32)).toBase58();

// PersonalPositionState (after the 8-byte Anchor discriminator and 1-byte bump).
function decodePosition(data: Buffer) {
  return {
    nftMint: readKey(data, 9),
    poolId: readKey(data, 41),
    tickLower: data.readInt32LE(73),
    tickUpper: data.readInt32LE(77),
    liquidity: readU128(data, 81),
  };
}

// PoolState, same 9-byte header.
function decodePool(data: Buffer) {
  return {
    ammConfig: readKey(data, 9),
    mint0: readKey(data, 73),
    mint1: readKey(data, 105),
    decimals0: data.readUInt8(233),
    decimals1: data.readUInt8(234),
    sqrtPriceX64: readU128(data, 253),
    tickCurrent: data.readInt32LE(269),
  };
}

async function getMultiple(conn: Connection, keys: PublicKey[]) {
  const out: (AccountInfo<Buffer> | null)[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    out.push(...await conn.getMultipleAccountsInfo(keys.slice(i, i + 100)));
  }
  return out;
}

async function loadSymbols(mints: string[]) {
  const missing = [...new Set(mints)].filter((m) => !symbolCache.has(m));
  if (missing.length) {
    try {
      const res = await fetch(RAYDIUM_MINT_API + missing.join(','));
      const { data } = (await res.json()) as { data?: ({ address?: string; symbol?: string } | null)[] };
      for (const t of data ?? []) if (t?.address && t.symbol) symbolCache.set(t.address, t.symbol);
    } catch {
      // Symbols are cosmetic; fall back to shortened mint addresses.
    }
  }
  return (m: string) => symbolCache.get(m) ?? `${m.slice(0, 4)}…${m.slice(-4)}`;
}

export async function getRaydiumPositions(conn: Connection, ownerAddress: string): Promise<Position[]> {
  const owner = new PublicKey(ownerAddress);

  // Position NFTs may be minted under either token program.
  const accounts = (await Promise.all([TOKEN_PROGRAM, TOKEN_2022_PROGRAM].map((programId) =>
    conn.getParsedTokenAccountsByOwner(owner, { programId })))).flatMap((r) => r.value);

  const nftMints = accounts
    .map((a) => a.account.data.parsed.info as { mint: string; tokenAmount: { amount: string; decimals: number } })
    .filter((info) => info.tokenAmount.decimals === 0 && info.tokenAmount.amount === '1')
    .map((info) => new PublicKey(info.mint));

  return positionsForNftMints(conn, ownerAddress, nftMints);
}

// NFTs that aren't Raydium position NFTs simply have no account at the derived PDA.
export async function positionsForNftMints(conn: Connection, ownerAddress: string, nftMints: PublicKey[]) {
  const positionKeys = nftMints.map((mint) =>
    PublicKey.findProgramAddressSync([Buffer.from('position'), mint.toBuffer()], CLMM_PROGRAM)[0]);

  const positions = (await getMultiple(conn, positionKeys))
    .flatMap((info) => (info?.owner.equals(CLMM_PROGRAM) ? [decodePosition(info.data)] : []));
  if (!positions.length) return [];

  const poolIds = [...new Set(positions.map((p) => p.poolId))];
  const pools = new Map((await getMultiple(conn, poolIds.map((id) => new PublicKey(id))))
    .flatMap((info, i) => (info ? [[poolIds[i]!, decodePool(info.data)] as const] : [])));

  // AmmConfig holds the fee tier; trade_fee_rate is in millionths.
  const configIds = [...new Set([...pools.values()].map((p) => p.ammConfig))];
  const feeRates = new Map((await getMultiple(conn, configIds.map((id) => new PublicKey(id))))
    .flatMap((info, i) => (info ? [[configIds[i]!, info.data.readUInt32LE(47)] as const] : [])));

  const symbol = await loadSymbols([...pools.values()].flatMap((p) => [p.mint0, p.mint1]));

  return positions.flatMap((p) => {
    const pool = pools.get(p.poolId);
    if (!pool) return [];
    const feeRate = feeRates.get(pool.ammConfig);
    return [buildPosition({
      id: p.nftMint,
      protocol: 'Raydium CLMM',
      chain: 'Solana',
      owner: ownerAddress,
      pool: p.poolId,
      feeTier: feeRate != null ? `${feeRate / 10000}%` : null,
      url: 'https://raydium.io/portfolio/',
      token0: { address: pool.mint0, symbol: symbol(pool.mint0), decimals: pool.decimals0 },
      token1: { address: pool.mint1, symbol: symbol(pool.mint1), decimals: pool.decimals1 },
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      tickCurrent: pool.tickCurrent,
      sqrtP: sqrtPriceFromX64(pool.sqrtPriceX64),
      liquidity: p.liquidity,
    })];
  });
}
