import WalletConnect from "@walletconnect/client";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LogView, useLogViewData } from "../components/LogView";
import { usePrompt } from "../components/Prompt";
import { ScrollContainer } from "../components/ScrollContainer";
import type { TWalletConnectScreenProps } from "../navigation";
import { useWalletQuery } from "../turnkey/TurnkeyQuery";
import { useTurnkeyWalletContext } from "../turnkey/TurnkeyWalletContext";
import {
  getEtherscanUrl,
  getNetworkDisplayValue,
  truncateAddress,
} from "../utils";
import { WalletConnectV2Screen } from "./WalletConnectV2Screen";

// See https://github.com/WalletConnect/walletconnect-monorepo/blob/c94c1d608e75ef7f0e77572a8627d9412ade24c3/packages/helpers/utils/src/constants.ts
const WALLETCONNECT_RESERVED_EVENTS = [
  "session_request",
  "session_update",
  "exchange_key",
  "connect",
  "disconnect",
  "display_uri",
  "modal_closed",
  "transport_open",
  "transport_close",
  "transport_error",
] as const;

const WALLETCONNECT_SIGNING_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v1",
  "eth_signTypedData_v2",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "personal_sign",
  "wallet_addEthereumChain",
  "wallet_switchEthereumChain",
  "wallet_getPermissions",
  "wallet_requestPermissions",
  "wallet_registerOnboarding",
  "wallet_watchAsset",
  "wallet_scanQRCode",
] as const;

const WALLETCONNECT_STATE_METHODS = [
  "eth_accounts",
  "eth_chainId",
  "net_version",
] as const;

export function WalletConnectScreen(props: TWalletConnectScreenProps) {
  const { uri } = props.route.params;

  // Auto-detect WalletConnect version
  const isV2 = React.useMemo(() => {
    if (!uri) return false;
    return uri.includes('@2') || uri.includes('relay-protocol=') || uri.includes('symKey=');
  }, [uri]);

  // Route to appropriate version
  if (isV2) {
    return <WalletConnectV2Screen {...props} />;
  }

  // V1 implementation below
  const { logList } = useWalletConnectSubscription({ uri });

  return (
    <ScrollContainer>
      <View style={styles.root}>
        <Text style={styles.versionBadge}>WalletConnect v1</Text>
        <LogView logList={logList} />
      </View>
    </ScrollContainer>
  );
}

// Get a (QR) link from https://example.walletconnect.org/
//
// More references:
// - https://docs.walletconnect.com/1.0/quick-start/wallets/react-native
// - https://docs.walletconnect.com/client-api
// - https://github.com/WalletConnect/walletconnect-monorepo/tree/v1.0/packages/clients/
function useWalletConnectSubscription(input: { uri: string }) {
  const { uri } = input;
  const { showPrompt } = usePrompt();
  const walletQuery = useWalletQuery();
  const { eip1193, network } = useTurnkeyWalletContext();

  const { logList, appendLog } = useLogViewData();

  const address = walletQuery.data?.address;
  const chainId = walletQuery.data?.chainId;
  const lastConnectedUri = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (address == null || chainId == null || eip1193 == null) {
      return;
    }
    if (lastConnectedUri.current === uri) {
      return;
    }
    // Don't attempt to connect if URI is missing or invalid
    if (!uri || !uri.startsWith('wc:')) {
      appendLog({
        label: "WalletConnect",
        data: "Waiting for valid WalletConnect URI (must start with 'wc:')",
      });
      return;
    }

    // Check if this is a WalletConnect v2 URI (not supported yet)
    if (uri.includes('@2') || uri.includes('relay-protocol=')) {
      appendLog({
        label: "WalletConnect Version Error",
        data: "❌ This app currently supports WalletConnect v1 only. The URI you provided is WalletConnect v2 (@2). Please use a dApp that supports WalletConnect v1, or use the URI format: wc:...@1?bridge=...",
      });
      return;
    }

    // Check if this is a v1 URI without bridge parameter
    if (uri.includes('@1') && !uri.includes('bridge=')) {
      appendLog({
        label: "WalletConnect Error",
        data: "❌ Invalid WalletConnect v1 URI: missing 'bridge' parameter. The URI should include: ...@1?bridge=https://...",
      });
      return;
    }

    lastConnectedUri.current = uri;

    try {
      appendLog({
        label: "WalletConnect",
        data: `Establishing connection (from ${truncateAddress(
          address
        )} on ${getNetworkDisplayValue(network)})`,
      });

      const connector = new WalletConnect({
        uri,
      });

      [
        ...WALLETCONNECT_RESERVED_EVENTS,
        ...WALLETCONNECT_SIGNING_METHODS,
        ...WALLETCONNECT_STATE_METHODS,
      ].forEach((eventName) => {
        connector.on(eventName, async (error, payload) => {
          const label = "`" + eventName + "`";

          if (error != null) {
            appendLog({
              label,
              data: `Error: ${error.message}`,
            });
            return;
          }

          switch (eventName) {
            case "session_request": {
              appendLog({
                label,
                data: `Handshaking with ${
                  payload?.params?.[0]?.peerMeta?.url ?? "<unknown>"
                }`,
              });

              const userInput = await showPrompt({
                title: "WalletConnect Session Request",
                message: `Would you like to connect to the WalletConnect session?`,
                actionList: [
                  {
                    id: "APPROVE",
                    title: "Approve",
                    type: "default",
                  },
                  {
                    id: "REJECT",
                    title: "Reject",
                    type: "cancel",
                  },
                ],
              });

              if (userInput.id === "APPROVE") {
                appendLog({
                  label: "User action",
                  data: "Approved connection request",
                });

                connector.approveSession({
                  chainId,
                  accounts: [address],
                });
              } else if (userInput.id === "REJECT") {
                appendLog({
                  label: "User action",
                  data: "Rejected connection request",
                });

                connector.rejectSession({
                  message: "User rejected request",
                });
              }
              return;
            }
            case "connect": {
              appendLog({
                label,
                data: `Connected to ${
                  payload?.params?.[0]?.peerMeta?.url ?? "<unknown>"
                }`,
              });
              return;
            }
            case "disconnect": {
              appendLog({
                label,
                data: "Session disconnected",
              });
              return;
            }
            case "eth_sendTransaction": {
              appendLog({
                label,
                data: payload,
              });

              const userInput = await showPrompt({
                title: `Request: ${label}`,
                message: `Would you like to approve this request?`,
                actionList: [
                  {
                    id: "APPROVE",
                    title: "Approve",
                    type: "default",
                  },
                  {
                    id: "REJECT",
                    title: "Reject",
                    type: "cancel",
                  },
                ],
              });

              if (userInput.id === "APPROVE") {
                appendLog({
                  label: "User action",
                  data: "Approved request",
                });

                const { method, params } = payload;

                let txHash: string;
                try {
                  txHash = await eip1193.send(
                    method,
                    cleanUpSendTxParams(params)
                  );
                } catch (error) {
                  appendLog({
                    label,
                    data: `Error: ${(error as Error).message}`,
                  });
                  return;
                }

                connector.approveRequest({
                  id: payload.id,
                  result: txHash,
                });

                const etherscanLink = getEtherscanUrl(`/tx/${txHash}`, network);

                appendLog({
                  label: "Transaction sent",
                  data: etherscanLink,
                });
              } else if (userInput.id === "REJECT") {
                appendLog({
                  label: "User action",
                  data: "Rejected request",
                });

                connector.rejectRequest({
                  id: payload.id,
                  error: {
                    message: "User rejected request",
                  },
                });
              }
              return;
            }
          }

          appendLog({
            label: label + " (unimplemented)",
            data: payload,
          });
        });
      });
    } catch (error) {
      appendLog({
        label: "Failed to connect",
        data: `Error: ${(error as Error).message}`,
      });
    }
  }, [uri, showPrompt, address, chainId, appendLog, network, eip1193]);

  return {
    logList,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  versionBadge: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

// Can't pass `gas` and `from` as-is to `Eip1193Bridge`
// See https://github.com/ethers-io/ethers.js/issues/1683
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanUpSendTxParams(params: any): any {
  const clonedParam = { ...params[0] };

  // TODO: Ask user for gas input
  delete clonedParam.gas;
  // TODO: verify that `from` matches the wallet's address
  delete clonedParam.from;

  return [clonedParam];
}
