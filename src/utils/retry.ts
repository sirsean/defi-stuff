// Lightweight retry utilities with exponential backoff and jitter
// ESM module

export type RetryOptions = {
  retries?: number;            // max attempts, including the first call (default 5)
  baseMs?: number;             // initial backoff (default 250ms)
  maxMs?: number;              // max backoff (default 2000ms)
  isRetryable?: (err: any) => boolean; // classify retryable errors
  onRetry?: (err: any, attempt: number, delayMs: number) => void; // hook for logging
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultIsRetryable(err: any): boolean {
  const msg = (err?.shortMessage || err?.message || '').toLowerCase();
  const reason = (err?.reason || '').toLowerCase();
  const code = String(err?.code || '');
  const httpStatus = (err?.status || err?.response?.status || err?.error?.status || undefined) as number | undefined;
  const jsonRpcCode = (err?.error?.code || err?.info?.error?.code || undefined) as number | undefined;

  // Common rate-limit signals
  if (httpStatus === 429) return true;
  if (msg.includes('rate limit') || msg.includes('too many requests')) return true;
  if (reason.includes('rate limit')) return true;

  // Some providers use generic server errors for transient conditions
  if (httpStatus === 503) return true;
  if (jsonRpcCode === -32005) return true; // often used as rate-limit / request limit

  // Ethers-style network hiccups
  if (code === 'SERVER_ERROR' || code === 'NETWORK_ERROR' || code === 'TIMEOUT') return true;

  // Missing revert data on eth_call often comes from node refusing or rate-limiting the call
  if (code === 'CALL_EXCEPTION' && msg.includes('missing revert data')) return true;

  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 5;
  const baseMs = opts.baseMs ?? 250;
  const maxMs = opts.maxMs ?? 2000;
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;
  let attempt = 0;
  let lastErr: any;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt >= retries || !isRetryable(err)) throw err;
      // Exponential backoff with full jitter
      const expo = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
      const delay = Math.floor(Math.random() * (expo + 1));
      if (opts.onRetry) opts.onRetry(err, attempt, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}

// Utility to safely describe which RPC we are using without leaking keys
export function maskRpcUrl(url: string): string {
  try {
    const u = new URL(url);
    // Redact everything after '/v2/' pattern (Alchemy), but keep host
    const v2Idx = u.pathname.indexOf('/v2/');
    if (v2Idx >= 0) {
      return `${u.protocol}//${u.host}${u.pathname.slice(0, v2Idx + 4)}***`;
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    // Fallback
    if (url.includes('alchemy.com')) return 'alchemy (masked)';
    if (url.includes('base.org')) return 'base mainnet public';
    return 'rpc (masked)';
  }
}