export interface Config {
  port: number;
  wallets: { ethereum: string[]; solana: string[] };
  rpc: { ethereum: string; solana: string };
  nearEdgeThreshold: number;
}

export async function loadConfig(): Promise<Config> {
  const file = Bun.file(`${import.meta.dir}/../../config.json`);
  if (!(await file.exists())) {
    console.error('Missing config.json — copy config.example.json to config.json and add your wallet addresses.');
    process.exit(1);
  }
  const raw = (await file.json()) as Partial<Config>;
  if (!raw.rpc?.ethereum || !raw.rpc?.solana) {
    console.error('config.json needs rpc.ethereum and rpc.solana URLs.');
    process.exit(1);
  }
  return {
    port: Number(process.env.PORT) || raw.port || 3000,
    wallets: { ethereum: raw.wallets?.ethereum ?? [], solana: raw.wallets?.solana ?? [] },
    rpc: raw.rpc,
    nearEdgeThreshold: raw.nearEdgeThreshold ?? 0.1,
  };
}
