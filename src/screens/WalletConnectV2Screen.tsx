import { getSdkError } from "@walletconnect/utils";
import { ethers } from "ethers";
import * as React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { Eip1193Bridge } from "@ethersproject/experimental";
import { TurnkeySigner } from "@turnkey/ethers";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { LogView, useLogViewData } from "../components/LogView";
import { usePrompt } from "../components/Prompt";
import { ScrollContainer } from "../components/ScrollContainer";
import type { TWalletConnectScreenProps } from "../navigation";
import { useWalletQuery } from "../turnkey/TurnkeyQuery";
import { useTurnkeyWalletContext, TNetwork, customRpcUrls, chainIds } from "../turnkey/TurnkeyWalletContext";
import { useWalletConnectV2Context } from "../walletconnect/WalletConnectV2Context";
import { useCredentialsContext } from "../turnkey/CredentialsContext";
import {
  getEtherscanUrl,
  getNetworkDisplayValue,
  truncateAddress,
} from "../utils";

export function WalletConnectV2Screen(props: TWalletConnectScreenProps) {
  const { uri } = props.route.params;
  const { web3wallet, isInitialized } = useWalletConnectV2Context();
  const [activeSessions, setActiveSessions] = React.useState<any[]>([]);

  const { logList } = useWalletConnectV2Subscription({ uri });

  // Load active sessions
  React.useEffect(() => {
    if (!web3wallet || !isInitialized) return;
    
    const loadSessions = () => {
      const sessions = web3wallet.getActiveSessions();
      const sessionList = Object.values(sessions);
      setActiveSessions(sessionList);
    };

    loadSessions();
    
    // Listen for session events to update the list
    const onSessionUpdate = () => {
      loadSessions();
    };
    
    web3wallet.on("session_proposal", onSessionUpdate);
    web3wallet.on("session_delete", onSessionUpdate);
    
    // Refresh sessions periodically as backup
    const interval = setInterval(loadSessions, 3000);
    
    return () => {
      clearInterval(interval);
      web3wallet.off("session_proposal", onSessionUpdate);
      web3wallet.off("session_delete", onSessionUpdate);
    };
  }, [web3wallet, isInitialized]);

  const handleDisconnect = async (topic: string, dappName: string) => {
    Alert.alert(
      "Disconnect Session",
      `Disconnect from ${dappName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await web3wallet?.disconnectSession({
                topic,
                reason: getSdkError("USER_DISCONNECTED"),
              });
              // Refresh sessions
              const sessions = web3wallet?.getActiveSessions() || {};
              setActiveSessions(Object.values(sessions));
            } catch (error) {
              Alert.alert("Error", `Failed to disconnect: ${(error as Error).message}`);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollContainer>
      <View style={styles.root}>
        <Text style={styles.versionBadge}>🚀 WalletConnect v2</Text>
        
        {activeSessions.length > 0 && (
          <View style={styles.sessionsContainer}>
            <Text style={styles.sessionsTitle}>Active Sessions ({activeSessions.length})</Text>
            {activeSessions.map((session) => (
              <View key={session.topic} style={styles.sessionCard}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionName}>
                    {session.peer.metadata.name}
                  </Text>
                  <Text style={styles.sessionUrl}>
                    {session.peer.metadata.url}
                  </Text>
                  <Text style={styles.sessionTopic}>
                    Topic: {truncateAddress(session.topic)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.disconnectButton}
                  onPress={() => handleDisconnect(session.topic, session.peer.metadata.name)}
                >
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        
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
  const { credentials } = useCredentialsContext();

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
        const { request, chainId: requestChainId } = params;

        // Extract chain info from the request
        const chainIdHex = requestChainId; // e.g., "eip155:42161" for Arbitrum
        const chainIdNum = chainIdHex ? parseInt(chainIdHex.split(':')[1]) : chainId;
        
        // Map chain ID to network name
        const getNetworkFromChainId = (id: number): string => {
          const chainMap: Record<number, string> = {
            1: "homestead",
            5: "goerli", 
            11155111: "sepolia",
            137: "matic",
            80001: "maticmum",
            10: "optimism",
            420: "optimism-goerli",
            42161: "arbitrum",
            421613: "arbitrum-goerli",
            8453: "base",
            84532: "base-sepolia",
            998: "hyperliquid",
          };
          return chainMap[id] || "homestead";
        };
        
        const requestNetwork = getNetworkFromChainId(chainIdNum);
        
        appendLog({
          label: `Request: ${request.method}`,
          data: `Chain: ${requestChainId} (${requestNetwork})\n${JSON.stringify(request.params, null, 2)}`,
        });

        const userInput = await showPrompt({
          title: `Request: ${request.method}`,
          message: `Chain: ${requestNetwork}\nWould you like to approve this request?`,
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

          // Create signer for the requested chain
          const createSignerForChain = (networkName: TNetwork) => {
            const {
              TURNKEY_API_PUBLIC_KEY,
              TURNKEY_API_PRIVATE_KEY,
              TURNKEY_BASE_URL,
              TURNKEY_ORGANIZATION_ID,
              SIGN_WITH,
              INFURA_API_KEY,
            } = credentials;

            const stamper = new ApiKeyStamper({
              apiPublicKey: TURNKEY_API_PUBLIC_KEY!,
              apiPrivateKey: TURNKEY_API_PRIVATE_KEY!,
            });

            const client = new TurnkeyClient({
              baseUrl: TURNKEY_BASE_URL!,
            }, stamper);

            const signer = new TurnkeySigner({
              client,
              organizationId: TURNKEY_ORGANIZATION_ID!,
              signWith: SIGN_WITH!,
            });

            // Create provider for the requested network
            let provider: ethers.providers.Provider;
            const customRpcUrl = customRpcUrls[networkName];
            if (customRpcUrl) {
              provider = new ethers.providers.JsonRpcProvider(customRpcUrl, {
                chainId: chainIds[networkName],
                name: networkName,
              });
            } else {
              provider = new ethers.providers.InfuraProvider(
                networkName,
                INFURA_API_KEY
              );
            }

            return {
              signer: signer.connect(provider),
              bridge: new Eip1193Bridge(signer.connect(provider), provider),
            };
          };

          let result: any;

          switch (request.method) {
            case "eth_sendTransaction":
              // Create signer for the requested chain
              const { bridge: requestBridge } = createSignerForChain(requestNetwork as TNetwork);
              
              const txParams = request.params[0];
              const cleanedParams = {
                to: txParams.to,
                value: txParams.value,
                data: txParams.data,
              };
              result = await requestBridge.send("eth_sendTransaction", [
                cleanedParams,
              ]);
              
              const etherscanLink = getEtherscanUrl(`/tx/${result}`, requestNetwork as TNetwork);
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
              // Create signer for the requested chain
              const { signer: requestSigner } = createSignerForChain(requestNetwork as TNetwork);
              
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
              result = await requestSigner._signTypedData(
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
  sessionsContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sessionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sessionCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sessionUrl: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  sessionTopic: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

