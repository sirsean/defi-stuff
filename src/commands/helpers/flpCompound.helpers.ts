export function hexToAddressFromTopic(topic: string): string {
  // topics are 32-byte hex; address is the right-most 20 bytes
  const clean = topic.toLowerCase();
  return "0x" + clean.slice(clean.length - 40);
}

export interface LogLike {
  address?: string;
  topics?: string[];
  data?: string;
}

export function parseUsdcTransfersToRecipient(
  logs: LogLike[] | undefined,
  transferTopicHash: string,
  usdcAddress: string,
  recipient: string,
): bigint {
  if (!logs || logs.length === 0) return 0n;
  const wantedTopic = transferTopicHash.toLowerCase();
  const usdcAddrLc = usdcAddress.toLowerCase();
  const recipientLc = recipient.toLowerCase();
  let total = 0n;
  for (const log of logs) {
    if (!log.address || log.address.toLowerCase() !== usdcAddrLc) continue;
    if (!log.topics || log.topics.length < 3) continue;
    if (log.topics[0]?.toLowerCase() !== wantedTopic) continue;
    const toAddr = "0x" + log.topics[2].slice(-40);
    if (toAddr.toLowerCase() !== recipientLc) continue;
    try {
      if (log.data) {
        total += BigInt(log.data);
      }
    } catch {}
  }
  return total;
}
