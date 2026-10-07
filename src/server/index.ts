import index from '../web/index.html';
import type { Position, PositionsResponse } from '../shared/types.ts';
import { loadConfig } from './config.ts';
import { createSolanaConnection, getRaydiumPositions } from './raydium.ts';
import { createUniswapClient, getUniswapPositions } from './uniswap.ts';

const config = await loadConfig();
const evm = createUniswapClient(config.rpc.ethereum);
const solana = createSolanaConnection(config.rpc.solana);

async function loadAll(): Promise<PositionsResponse> {
  const jobs: { label: string; run: () => Promise<Position[]> }[] = [
    ...config.wallets.ethereum.map((w) => ({ label: `Uniswap ${w}`, run: () => getUniswapPositions(evm, w) })),
    ...config.wallets.solana.map((w) => ({ label: `Raydium ${w}`, run: () => getRaydiumPositions(solana, w) })),
  ];
  const results = await Promise.allSettled(jobs.map((j) => j.run()));
  const errors: string[] = [];
  const positions = results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const { label } = jobs[i]!;
    console.error(label, r.reason);
    errors.push(`${label}: ${r.reason?.shortMessage ?? r.reason?.message ?? r.reason}`);
    return [];
  });
  return { positions, errors, nearEdgeThreshold: config.nearEdgeThreshold, updatedAt: new Date().toISOString() };
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: config.port,
  routes: {
    '/': index,
    '/api/positions': async () => {
      try {
        return Response.json(await loadAll());
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 500 });
      }
    },
  },
  fetch: () => new Response('Not found', { status: 404 }),
  development: process.env.NODE_ENV !== 'production' && { hmr: true, console: true },
});

console.log(`LP dashboard running at ${server.url}`);
