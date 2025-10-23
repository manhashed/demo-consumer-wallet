import type { TNetwork } from "./turnkey/TurnkeyWalletContext";

const networkDisplayNames: Partial<Record<TNetwork, string>> = {
  "homestead": "mainnet",
  "maticmum": "polygon-mumbai",
  "base": "base",
  "base-sepolia": "base-sepolia",
  "hyperliquid": "hyperliquid",
};

export function getNetworkDisplayValue(network: TNetwork): string {
  return networkDisplayNames[network] || network;
}

// Map networks to their block explorer URLs
const blockExplorerUrls: Partial<Record<TNetwork, string>> = {
  "homestead": "https://etherscan.io/",
  "goerli": "https://goerli.etherscan.io/",
  "sepolia": "https://sepolia.etherscan.io/",
  "matic": "https://polygonscan.com/",
  "maticmum": "https://mumbai.polygonscan.com/",
  "optimism": "https://optimistic.etherscan.io/",
  "optimism-goerli": "https://goerli-optimism.etherscan.io/",
  "arbitrum": "https://arbiscan.io/",
  "arbitrum-goerli": "https://goerli.arbiscan.io/",
  "base": "https://basescan.org/",
  "base-sepolia": "https://sepolia.basescan.org/",
  "hyperliquid": "https://app.hyperliquid.xyz/explorer/",
};

export function getEtherscanUrl(
  urlPath: string,
  network: TNetwork
): string {
  const baseUrl = blockExplorerUrls[network] || `https://${network}.etherscan.io/`;
  return new URL(urlPath, baseUrl).href;
}

export function truncateAddress(input: string): string {
  return input.slice(0, 6) + "..." + input.slice(-4);
}

export function assertNonEmptyString(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  x: any,
  name: string
): asserts x is string {
  if (typeof x !== "string" || !x) {
    throw new Error(
      `Expected ${name} to be a non-empty string, got ${JSON.stringify(x)}`
    );
  }
}

// Etherscan-compatible API endpoints (v1 - current standard)
// Note: Etherscan API v2 doesn't exist yet. When it's released, update these URLs.
const etherscanApiUrls: Partial<Record<TNetwork, string>> = {
  "homestead": "https://api.etherscan.io/api",
  "goerli": "https://api-goerli.etherscan.io/api",
  "sepolia": "https://api-sepolia.etherscan.io/api",
  "matic": "https://api.polygonscan.com/api",
  "maticmum": "https://api-testnet.polygonscan.com/api",
  "optimism": "https://api-optimistic.etherscan.io/api",
  "optimism-goerli": "https://api-goerli-optimistic.etherscan.io/api",
  "arbitrum": "https://api.arbiscan.io/api",
  "arbitrum-goerli": "https://api-goerli.arbiscan.io/api",
  "base": "https://api.basescan.org/api",
  "base-sepolia": "https://api-sepolia.basescan.org/api",
};

export function getEtherscanApiUrl(network: TNetwork): string {
  return etherscanApiUrls[network] || `https://api-${network}.etherscan.io/api`;
}

interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  confirmations: string;
}

export async function fetchEtherscanApi<T>(
  network: TNetwork,
  params: Record<string, string>,
  apiKey: string
): Promise<T> {
  // Check if network has Etherscan API support
  if (!etherscanApiUrls[network]) {
    throw new Error(`Etherscan API not available for network: ${network}`);
  }
  
  const baseUrl = getEtherscanApiUrl(network);
  const url = new URL(baseUrl);
  
  // Add all params to URL
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  // Add API key
  url.searchParams.append('apikey', apiKey);
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Handle Etherscan API errors
  if (data.status === '0') {
    // "No transactions found" is not an error
    if (data.message === 'No transactions found') {
      return [] as T;
    }
    // Other errors
    throw new Error(data.result || data.message || 'API returned error status');
  }
  
  return data.result as T;
}

export async function getTransactionHistory(
  address: string,
  network: TNetwork,
  apiKey: string
): Promise<EtherscanTransaction[]> {
  return fetchEtherscanApi<EtherscanTransaction[]>(
    network,
    {
      module: 'account',
      action: 'txlist',
      address: address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: '100',
      sort: 'desc',
    },
    apiKey
  );
}
