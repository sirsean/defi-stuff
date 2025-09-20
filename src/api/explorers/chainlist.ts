import axios from 'axios';

export interface ChainEntry {
  chainname: string;
  chainid: string; // numeric string per Etherscan chainlist
  blockexplorer: string;
  apiurl: string;
  status: number; // 0=Offline,1=Ok,2=Degraded
  comment: string;
}

export interface ChainlistResponse {
  comments: string;
  totalcount: number;
  result: ChainEntry[];
}

const ETHERSCAN_CHAINLIST_URL = 'https://api.etherscan.io/v2/chainlist';

export async function fetchEtherscanChainlist(): Promise<ChainEntry[]> {
  const { data } = await axios.get<ChainlistResponse>(ETHERSCAN_CHAINLIST_URL, { timeout: 10_000 });
  return data.result ?? [];
}

export async function findChainById(chainId: string): Promise<ChainEntry | undefined> {
  const list = await fetchEtherscanChainlist();
  return list.find((c) => c.chainid === chainId);
}

export async function findChainByName(name: string): Promise<ChainEntry | undefined> {
  const list = await fetchEtherscanChainlist();
  const lower = name.toLowerCase();
  return list.find((c) => c.chainname.toLowerCase().includes(lower));
}
