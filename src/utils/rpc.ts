// Centralized RPC URL helpers

export function getBaseRpcUrl(): string {
  const key = process.env.ALCHEMY_API_KEY;
  return key && key.trim().length > 0
    ? `https://base-mainnet.g.alchemy.com/v2/${key}`
    : 'https://mainnet.base.org';
}