import { Eip1193Bridge } from "@ethersproject/experimental";
import { TurnkeySigner } from "@turnkey/ethers";
import { ethers } from "ethers";
import * as React from "react";
import { assertNonEmptyString } from "../utils";
import { useCredentialsContext } from "./CredentialsContext";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";


// Network configuration with support for Infura and custom RPC endpoints
export const networkList = [
  "homestead",
  "goerli",
  "sepolia",
  "matic",
  "maticmum",
  "optimism",
  "optimism-goerli",
  "arbitrum",
  "arbitrum-goerli",
  "base",
  "base-sepolia",
  "hyperliquid",
] as const;

export type TNetwork = (typeof networkList)[number];

// Custom RPC URLs for networks not supported by Infura
export const customRpcUrls: Partial<Record<TNetwork, string>> = {
  "base": "https://mainnet.base.org",
  "base-sepolia": "https://sepolia.base.org",
  "hyperliquid": "https://api.hyperliquid.xyz/evm",
};

// Chain IDs for each network
export const chainIds: Record<TNetwork, number> = {
  "homestead": 1,
  "goerli": 5,
  "sepolia": 11155111,
  "matic": 137,
  "maticmum": 80001,
  "optimism": 10,
  "optimism-goerli": 420,
  "arbitrum": 42161,
  "arbitrum-goerli": 421613,
  "base": 8453,
  "base-sepolia": 84532,
  "hyperliquid": 998,
};

type TTurnkeyWalletContextValue = {
  connectedSigner: TurnkeySigner | null;
  eip1193: Eip1193Bridge | null;
  network: TNetwork;
  setNetwork: (x: TNetwork) => void;
  error: Error | null;
} | null;

const TurnkeyWalletContext =
  React.createContext<TTurnkeyWalletContextValue>(null);

export function TurnkeyWalletContextProvider(props: {
  children: React.ReactNode;
}) {
  const [network, setNetwork] = React.useState<TNetwork>("homestead");
  const { credentials } = useCredentialsContext();
  const {
    TURNKEY_API_PUBLIC_KEY,
    TURNKEY_API_PRIVATE_KEY,
    TURNKEY_BASE_URL,
    TURNKEY_ORGANIZATION_ID,
    SIGN_WITH,
    INFURA_API_KEY,
  } = credentials;

  const contextValue = React.useMemo(() => {
    let connectedSigner: TurnkeySigner | null = null;
    let eip1193: Eip1193Bridge | null = null;
    let error: Error | null = null;

    try {
      assertNonEmptyString(TURNKEY_API_PUBLIC_KEY, "TURNKEY_API_PUBLIC_KEY");
      assertNonEmptyString(TURNKEY_API_PRIVATE_KEY, "TURNKEY_API_PRIVATE_KEY");
      assertNonEmptyString(TURNKEY_BASE_URL, "TURNKEY_BASE_URL");
      assertNonEmptyString(TURNKEY_ORGANIZATION_ID, "TURNKEY_ORGANIZATION_ID");
      assertNonEmptyString(SIGN_WITH, "SIGN_WITH");

      const stamper = new ApiKeyStamper({
        apiPublicKey: TURNKEY_API_PUBLIC_KEY,
        apiPrivateKey: TURNKEY_API_PRIVATE_KEY,
      });

      const client = new TurnkeyClient({
        baseUrl: TURNKEY_BASE_URL,
      }, stamper)
      
      const signer = new TurnkeySigner({
        client: client,
        organizationId: TURNKEY_ORGANIZATION_ID,
        signWith: SIGN_WITH,
      });

      // Use custom RPC URL if available, otherwise use Infura
      let provider: ethers.providers.Provider;
      const customRpcUrl = customRpcUrls[network];
      if (customRpcUrl) {
        provider = new ethers.providers.JsonRpcProvider(customRpcUrl, {
          chainId: chainIds[network],
          name: network,
        });
      } else {
        // For Infura-supported networks
        provider = new ethers.providers.InfuraProvider(
          network,
          INFURA_API_KEY
        );
      }

      connectedSigner = signer.connect(provider);
      eip1193 = new Eip1193Bridge(connectedSigner, provider);
    } catch (e) {
      error = e as Error;
    }

    return {
      connectedSigner,
      eip1193,
      network,
      setNetwork,
      error,
    };
  }, [
    INFURA_API_KEY,
    TURNKEY_API_PRIVATE_KEY,
    TURNKEY_API_PUBLIC_KEY,
    TURNKEY_BASE_URL,
    TURNKEY_ORGANIZATION_ID,
    SIGN_WITH,
    network,
  ]);

  return (
    <TurnkeyWalletContext.Provider value={contextValue}>
      {props.children}
    </TurnkeyWalletContext.Provider>
  );
}

export function useTurnkeyWalletContext(): NonNullable<TTurnkeyWalletContextValue> {
  const value = React.useContext(TurnkeyWalletContext);

  if (value == null) {
    throw new Error(
      `Context wasn't initialized. Did you forget to put a \`<TurnkeyWalletContextProvider>\` ancestor?`
    );
  }

  return value;
}
