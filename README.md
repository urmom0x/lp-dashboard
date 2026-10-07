# LP Dashboard

One page showing whether your concentrated-liquidity positions are in range, across:

- **Uniswap v3** on Ethereum
- **Raydium CLMM** on Solana

It finds positions from wallet addresses alone. You never connect a wallet, and it never sees a private key.

## Setup

Requires [Bun](https://bun.sh) 1.3+.

```sh
bun install
cp config.example.json config.json   # then edit it
bun dev                              # http://localhost:3000, with hot reload
```

| Script | |
|---|---|
| `bun dev` | Dev server with hot reload for both the server and the React app |
| `bun start` | Production mode (minified bundle, no HMR) |
| `bun run typecheck` | `tsc --noEmit` |

Set `PORT=3001` to override the port from `config.json`.

### config.json

| Field | Notes |
|---|---|
| `wallets.ethereum` / `wallets.solana` | Lists, so you can track several wallets per chain. |
| `rpc.ethereum` | The default public endpoint works. A free Alchemy/Infura key is more reliable. |
| `rpc.solana` | The public endpoint works but is heavily rate-limited. A free [Helius](https://helius.dev) key is more reliable: `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY` |
| `nearEdgeThreshold` | Flags an in-range position as "Near edge" when price is in the outer slice of the range. `0.1` = outer 10% on either side. |

`config.json` is gitignored, so your addresses and keys stay local. The server only listens on `127.0.0.1`.

## What it shows

- **Status:** In range / Near edge / Out of range. Positions needing attention sort first.
- **Range bar:** your min–max band, with a marker for the current price.
- **Min / current / max prices** and how far price is from the range edge. Click ⇄ to invert the price (remembered per position).
- **Holdings:** current token amounts in the position.
- **Unclaimed fees:** Uniswap only (simulated `collect` call).

Closed (zero-liquidity) positions are hidden unless you tick "Show closed positions". The page refreshes every minute, and the tab title shows how many positions are out of range.

## How discovery works

- **Uniswap v3:** enumerates the position NFTs your address holds on the NonfungiblePositionManager, then reads each pool's current tick.
- **Raydium CLMM:** lists the NFTs your wallet holds (classic SPL and Token-2022), derives each one's `position` PDA under the CLMM program, and keeps those that exist.

## Layout

Bun serves both the API and the React app from one process. Importing `index.html` in the server makes Bun bundle the TSX itself, so there's no Vite or separate build step.

```
src/shared/types.ts        Position / API types shared by server and UI
src/server/index.ts        Bun.serve: /api/positions + the React app
src/server/config.ts       config.json loading
src/server/uniswap.ts      Uniswap v3 fetcher (viem)
src/server/raydium.ts      Raydium CLMM fetcher (@solana/web3.js, raw account decoding)
src/server/math.ts         tick/price/liquidity math, builds the shared Position shape
src/web/index.html         entry page (Bun bundles main.tsx from here)
src/web/App.tsx            filtering, sorting, summary counts
src/web/components/        PositionCard, RangeBar, SummaryTiles, Filters, StatusDot
src/web/hooks/             usePositions (fetch + 1-min refresh), useFlipped (localStorage)
src/web/lib/positions.ts   status, price orientation, formatting helpers
```
