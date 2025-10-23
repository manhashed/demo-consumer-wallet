import { getSdkError } from "@walletconnect/utils";
import { ethers } from "ethers";
import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LogView, useLogViewData } from "../components/LogView";
import { usePrompt } from "../components/Prompt";
import { ScrollContainer } from "../components/ScrollContainer";
import type { TWalletConnectScreenProps } from "../navigation";
import { useWalletQuery } from "../turnkey/TurnkeyQuery";
import { useTurnkeyWalletContext } from "../turnkey/TurnkeyWalletContext";
import { useWalletConnectV2Context } from "../walletconnect/WalletConnectV2Context";
import {
  getEtherscanUrl,
  getNetworkDisplayValue,
  truncateAddress,
} from "../utils";

export function WalletConnectV2Screen(props: TWalletConnectScreenProps) {
  const { uri } = props.route.params;

  const { logList } = useWalletConnectV2Subscription({ uri });

  return (
    <ScrollContainer>
      <View style={styles.root}>
        <Text style={styles.versionBadge}>🚀 WalletConnect v2</Text>
        <LogView logList={logList} />
      </View>
    </ScrollContainer>
  );
}

function useWalletConnectV2Subscription(input: { uri: string }) {
  const { uri } = input;
  const { showPrompt } = usePrompt();
  const walletQuery = useWalletQuery();
  const { eip1193, network, connectedSigner } = useTurnkeyWalletContext();
  const { web3wallet, isInitialized } = useWalletConnectV2Context();

  const { logList, appendLog } = useLogViewData();

  const address = walletQuery.data?.address;
  const chainId = walletQuery.data?.chainId;
  const lastConnectedUri = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!web3wallet || !isInitialized) {
      appendLog({
        label: "WalletConnect",
        data: "Initializing WalletConnect v2...",
      });
      return;
    }

    if (address == null || chainId == null || eip1193 == null || connectedSigner == null) {
      return;
    }

    if (lastConnectedUri.current === uri) {
      return;
    }

    // Validate URI
    if (!uri || !uri.startsWith('wc:')) {
      appendLog({
        label: "WalletConnect",
        data: "Waiting for valid WalletConnect URI (must start with 'wc:')",
      });
      return;
    }

    // Check if this is a v1 URI
    if (uri.includes('@1') || uri.includes('bridge=')) {
      appendLog({
        label: "WalletConnect Version Error",
        data: "❌ This screen supports WalletConnect v2 only. The URI you provided is WalletConnect v1 (@1). Please use a dApp that supports WalletConnect v2, or use the URI format: wc:...@2?relay-protocol=...",
      });
      return;
    }

    lastConnectedUri.current = uri;

    const setupWalletConnect = async () => {
      try {
        appendLog({
          label: "WalletConnect v2",
          data: `Pairing with dApp (from ${truncateAddress(
            address
          )} on ${getNetworkDisplayValue(network)})`,
        });

        // Pair with the dApp
        await web3wallet.pair({ uri });

        appendLog({
          label: "WalletConnect v2",
          data: "Pairing successful, waiting for session proposal...",
        });
      } catch (error) {
        appendLog({
          label: "Pairing Error",
          data: `Error: ${(error as Error).message}`,
        });
      }
    };

    setupWalletConnect();

    // Handle session proposals
    const onSessionProposal = async (proposal: any) => {
      try {
        appendLog({
          label: "Session Proposal",
          data: `Request from: ${proposal.params.proposer.metadata.name}`,
        });

        const userInput = await showPrompt({
          title: "WalletConnect Session Request",
          message: `${proposal.params.proposer.metadata.name} wants to connect. Do you approve?`,
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

          // Log the proposal to understand its structure
          appendLog({
            label: "Proposal Details",
            data: JSON.stringify(proposal.params, null, 2),
          });

          const approvedNamespaces: any = {};
          const requiredNamespaces = proposal.params.requiredNamespaces || {};
          const optionalNamespaces = proposal.params.optionalNamespaces || {};
          
          // Process required namespaces
          Object.keys(requiredNamespaces).forEach((key) => {
            const namespace = requiredNamespaces[key];
            const chains = namespace.chains || [];
            const accounts: string[] = [];
            
            // If no chains specified, use current chain
            if (chains.length === 0 && chainId) {
              chains.push(`eip155:${chainId}`);
            }
            
            chains.forEach((chain: string) => {
              accounts.push(`${chain}:${address}`);
            });

            if (accounts.length > 0) {
              approvedNamespaces[key] = {
                chains: chains,
                accounts: accounts,
                methods: namespace.methods || [],
                events: namespace.events || [],
              };
            }
          });

          // Process optional namespaces if required is empty
          if (Object.keys(approvedNamespaces).length === 0) {
            Object.keys(optionalNamespaces).forEach((key) => {
              const namespace = optionalNamespaces[key];
              const chains = namespace.chains || [];
              const accounts: string[] = [];
              
              // If no chains specified, use current chain
              if (chains.length === 0 && chainId) {
                chains.push(`eip155:${chainId}`);
              }
              
              chains.forEach((chain: string) => {
                accounts.push(`${chain}:${address}`);
              });

              if (accounts.length > 0) {
                approvedNamespaces[key] = {
                  chains: chains,
                  accounts: accounts,
                  methods: namespace.methods || [],
                  events: namespace.events || [],
                };
              }
            });
          }

          // Validate that we have at least one namespace with data
          if (Object.keys(approvedNamespaces).length === 0) {
            appendLog({
              label: "Namespace Error",
              data: "No valid namespaces found in proposal. Required: " + JSON.stringify(requiredNamespaces),
            });
            throw new Error("No valid namespaces to approve. The dApp did not specify any chains.");
          }

          appendLog({
            label: "Approved Namespaces",
            data: JSON.stringify(approvedNamespaces, null, 2),
          });

          const session = await web3wallet.approveSession({
            id: proposal.id,
            namespaces: approvedNamespaces,
          });

          appendLog({
            label: "Session Approved",
            data: `Connected to ${proposal.params.proposer.metadata.name}`,
          });
        } else {
          appendLog({
            label: "User action",
            data: "Rejected connection request",
          });

          await web3wallet.rejectSession({
            id: proposal.id,
            reason: getSdkError("USER_REJECTED"),
          });
        }
      } catch (error) {
        appendLog({
          label: "Session Error",
          data: `Error: ${(error as Error).message}`,
        });
      }
    };

    // Handle session requests (transactions, signing, etc.)
    const onSessionRequest = async (event: any) => {
      try {
        const { topic, params, id } = event;
        const { request } = params;

        appendLog({
          label: `Request: ${request.method}`,
          data: JSON.stringify(request.params, null, 2),
        });

        const userInput = await showPrompt({
          title: `Request: ${request.method}`,
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

          let result: any;

          switch (request.method) {
            case "eth_sendTransaction":
              const txParams = request.params[0];
              const cleanedParams = {
                to: txParams.to,
                value: txParams.value,
                data: txParams.data,
              };
              result = await eip1193.send("eth_sendTransaction", [
                cleanedParams,
              ]);
              
              const etherscanLink = getEtherscanUrl(`/tx/${result}`, network);
              appendLog({
                label: "Transaction sent",
                data: etherscanLink,
              });
              break;

            case "personal_sign":
              result = await eip1193.send("personal_sign", request.params);
              appendLog({
                label: "Message signed",
                data: `Signature: ${result}`,
              });
              break;

            case "eth_signTypedData":
            case "eth_signTypedData_v4":
              // Use signer directly for typed data signing
              // EIP-1193 bridge doesn't support this method properly
              if (!connectedSigner) {
                throw new Error("Signer not available");
              }
              
              // Parse the typed data
              const [signerAddress, typedDataJson] = request.params;
              const typedData = typeof typedDataJson === 'string' ? JSON.parse(typedDataJson) : typedDataJson;
              
              appendLog({
                label: "Signing Typed Data",
                data: JSON.stringify(typedData, null, 2),
              });
              
              // Remove EIP712Domain from types - ethers.js handles this automatically
              const { EIP712Domain, ...typesWithoutDomain } = typedData.types;
              
              // Sign using ethers.js _signTypedData method
              result = await connectedSigner._signTypedData(
                typedData.domain,
                typesWithoutDomain,
                typedData.message
              );
              
              appendLog({
                label: "Typed data signed",
                data: `Signature: ${result}`,
              });
              break;

            default:
              // Try to execute the method
              result = await eip1193.send(request.method, request.params);
              appendLog({
                label: "Request executed",
                data: `Result: ${JSON.stringify(result)}`,
              });
          }

          await web3wallet.respondSessionRequest({
            topic,
            response: {
              id,
              jsonrpc: "2.0",
              result,
            },
          });
        } else {
          appendLog({
            label: "User action",
            data: "Rejected request",
          });

          await web3wallet.respondSessionRequest({
            topic,
            response: {
              id,
              jsonrpc: "2.0",
              error: {
                code: 5000,
                message: "User rejected request",
              },
            },
          });
        }
      } catch (error) {
        appendLog({
          label: "Request Error",
          data: `Error: ${(error as Error).message}`,
        });

        await web3wallet.respondSessionRequest({
          topic: event.topic,
          response: {
            id: event.id,
            jsonrpc: "2.0",
            error: {
              code: 5001,
              message: (error as Error).message,
            },
          },
        });
      }
    };

    // Handle session deletes
    const onSessionDelete = (event: any) => {
      appendLog({
        label: "Session Deleted",
        data: "The dApp disconnected the session",
      });
    };

    // Register event listeners
    web3wallet.on("session_proposal", onSessionProposal);
    web3wallet.on("session_request", onSessionRequest);
    web3wallet.on("session_delete", onSessionDelete);

    // Cleanup
    return () => {
      web3wallet.off("session_proposal", onSessionProposal);
      web3wallet.off("session_request", onSessionRequest);
      web3wallet.off("session_delete", onSessionDelete);
    };
  }, [uri, web3wallet, isInitialized, showPrompt, address, chainId, appendLog, network, eip1193, connectedSigner]);

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
    backgroundColor: '#e8f5e9',
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#2e7d32',
  },
});

