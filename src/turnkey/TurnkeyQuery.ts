import { ethers } from "ethers";
import useSWR from "swr";
import { useCredentialsContext } from "./CredentialsContext";
import { useTurnkeyWalletContext } from "./TurnkeyWalletContext";
import { getTransactionHistory } from "../utils";

export function useHistoryQuery() {
  const { credentials } = useCredentialsContext();
  const { connectedSigner, network } = useTurnkeyWalletContext();
  const { SIGN_WITH, ETHERSCAN_API_KEY } = credentials;

  const cacheKey = ["history", network, SIGN_WITH || "<unknown>"];

  return useSWR(cacheKey, async () => {
    if (connectedSigner == null) {
      throw new Error(`Signer has not been initialized`);
    }
    if (!ETHERSCAN_API_KEY) {
      throw new Error(`Cannot find ETHERSCAN_API_KEY`);
    }

    const address = await connectedSigner.getAddress();
    
    try {
      // Try custom Etherscan API implementation first
      const rawTransactions = await getTransactionHistory(
        address,
        network,
        ETHERSCAN_API_KEY
      );

      // Convert to ethers.js format for compatibility
      const transactionList = rawTransactions.map((tx) => ({
        hash: tx.hash,
        blockNumber: parseInt(tx.blockNumber),
        timestamp: parseInt(tx.timeStamp),
        from: tx.from,
        to: tx.to || null,
        value: ethers.BigNumber.from(tx.value),
        gasPrice: ethers.BigNumber.from(tx.gasPrice),
        gasLimit: ethers.BigNumber.from(tx.gas),
        data: tx.input,
        confirmations: parseInt(tx.confirmations),
      }));

      return {
        address,
        transactionList,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // If network doesn't have Etherscan API, return empty history
      if (errorMessage.includes('not available for network')) {
        console.log(`Transaction history not available for ${network}`);
        return {
          address,
          transactionList: [],
        };
      }
      
      // For other errors, try fallback to ethers.js provider
      console.warn("Custom Etherscan API failed, trying fallback:", errorMessage);
      
      try {
        const etherscanProvider = new ethers.providers.EtherscanProvider(
          network,
          ETHERSCAN_API_KEY
        );

        const transactionList = [
          ...(await etherscanProvider.getHistory(address)),
        ].sort((item1, item2) => (item2.timestamp ?? 0) - (item1.timestamp ?? 0));

        return {
          address,
          transactionList,
        };
      } catch (fallbackError) {
        // If fallback also fails, return empty history
        console.log(`Transaction history unavailable for ${network}:`, (fallbackError as Error).message);
        return {
          address,
          transactionList: [],
        };
      }
    }
  });
}

export function useWalletQuery() {
  const { credentials } = useCredentialsContext();
  const { connectedSigner, network } = useTurnkeyWalletContext();
  const { SIGN_WITH } = credentials;

  const cacheKey = ["wallet", network, SIGN_WITH || "<unknown>"];

  return useSWR(cacheKey, async () => {
    if (connectedSigner == null) {
      throw new Error(`Signer has not been initialized`);
    }

    return {
      address: await connectedSigner.getAddress(),
      balance: await connectedSigner.getBalance(),
      transactionCount: await connectedSigner.getTransactionCount(),
      chainId: await connectedSigner.getChainId(),
    };
  });
}
