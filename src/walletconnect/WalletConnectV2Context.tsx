import { Core } from "@walletconnect/core";
import { Web3Wallet, IWeb3Wallet } from "@walletconnect/web3wallet";
import ExpoConstants from "expo-constants";
import * as React from "react";
import { Platform } from "react-native";
import { useCredentialsContext } from "../turnkey/CredentialsContext";

// WalletConnect Cloud Project ID
// Get yours at: https://cloud.walletconnect.com/
const getProjectIdFromEnv = (): string | null => {
  // Try to get from environment first
  if (process.env.WALLETCONNECT_PROJECT_ID) {
    return process.env.WALLETCONNECT_PROJECT_ID;
  }
  // Try Expo constants (for mobile)
  if (ExpoConstants.manifest?.extra?.WALLETCONNECT_PROJECT_ID) {
    return ExpoConstants.manifest.extra.WALLETCONNECT_PROJECT_ID;
  }
  return null;
};

type TWalletConnectV2ContextValue = {
  web3wallet: IWeb3Wallet | null;
  isInitialized: boolean;
  error: Error | null;
} | null;

const WalletConnectV2Context =
  React.createContext<TWalletConnectV2ContextValue>(null);

export function WalletConnectV2ContextProvider(props: {
  children: React.ReactNode;
}) {
  const { credentials } = useCredentialsContext();
  const [web3wallet, setWeb3Wallet] = React.useState<IWeb3Wallet | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const initWalletConnect = async () => {
      try {
        // Get Project ID from credentials first, then fall back to env
        const projectId = credentials.WALLETCONNECT_PROJECT_ID || getProjectIdFromEnv();
        
        if (!projectId) {
          console.warn("⚠️ No WalletConnect Project ID configured. Get one at https://cloud.walletconnect.com/");
          setError(new Error("WalletConnect Project ID not configured"));
          return;
        }

        console.log("🔗 Initializing WalletConnect v2 with Project ID:", projectId.substring(0, 8) + "...");

        // Initialize Web3Wallet with Core configuration
        const wallet = await Web3Wallet.init({
          core: new Core({
            projectId: projectId,
          }) as any, // Type cast to avoid version mismatch
          metadata: {
            name: "Turnkey Demo Wallet",
            description: "Demo consumer wallet powered by Turnkey",
            url: "https://turnkey.com",
            icons: ["https://avatars.githubusercontent.com/u/101629493"],
          },
        });

        setWeb3Wallet(wallet);
        setIsInitialized(true);
        console.log("✅ WalletConnect v2 initialized successfully");
      } catch (err) {
        console.error("❌ Failed to initialize WalletConnect:", err);
        setError(err as Error);
      }
    };

    initWalletConnect();
  }, [credentials.WALLETCONNECT_PROJECT_ID]);

  const contextValue = React.useMemo(() => {
    return {
      web3wallet,
      isInitialized,
      error,
    };
  }, [web3wallet, isInitialized, error]);

  return (
    <WalletConnectV2Context.Provider value={contextValue}>
      {props.children}
    </WalletConnectV2Context.Provider>
  );
}

export function useWalletConnectV2Context(): NonNullable<TWalletConnectV2ContextValue> {
  const value = React.useContext(WalletConnectV2Context);

  if (value == null) {
    throw new Error(
      `Context wasn't initialized. Did you forget to put a \`<WalletConnectV2ContextProvider>\` ancestor?`
    );
  }

  return value;
}

