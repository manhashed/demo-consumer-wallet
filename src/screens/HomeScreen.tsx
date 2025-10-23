import { useActionSheet } from "@expo/react-native-action-sheet";
import { ethers } from "ethers";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Button, StyleSheet, View, Text, TouchableOpacity, Alert } from "react-native";
import { LabeledRow } from "../components/Design";
import { ScrollContainer } from "../components/ScrollContainer";
import { WalletConnectInputView } from "../components/WalletConnectInputView";
import { useTypedNavigation } from "../navigation";
import { useCredentialsContext } from "../turnkey/CredentialsContext";
import { useWalletQuery } from "../turnkey/TurnkeyQuery";
import {
  networkList,
  useTurnkeyWalletContext,
} from "../turnkey/TurnkeyWalletContext";
import { getEtherscanUrl, getNetworkDisplayValue, truncateAddress } from "../utils";
import { useWalletConnectV2Context } from "../walletconnect/WalletConnectV2Context";
import { getSdkError } from "@walletconnect/utils";

export function HomeScreen() {
  const { network, error } = useTurnkeyWalletContext();
  const { credentials, hasAllCredentials } = useCredentialsContext();

  const walletQuery = useWalletQuery();

  const address = walletQuery.data?.address;
  const balance = walletQuery.data?.balance;
  const transactionCount = walletQuery.data?.transactionCount;

  let content: React.ReactNode;

  if (!hasAllCredentials) {
    content = (
      <>
        <LabeledRow
          label="Welcome!"
          value="Please fill in your Turnkey credentials"
        />
        <SettingsLink />
      </>
    );
  } else if (error != null) {
    content = (
      <>
        <LabeledRow label="Error" value={error.message} />
        <SettingsLink />
      </>
    );
  } else {
    content = (
      <>
        <LabeledRow
          label="Sign With"
          value={credentials.SIGN_WITH || "<unknown>"}
        />
        <NetworkRow />
        <LabeledRow
          label="Wallet address"
          auxiliary={address == null ? undefined : "Etherscan ↗"}
          value={address ?? "–"}
          onValuePress={
            address == null
              ? undefined
              : async () => {
                  await WebBrowser.openBrowserAsync(
                    getEtherscanUrl(`/address/${address}`, network)
                  );
                }
          }
        />
        <LabeledRow
          label="Wallet balance"
          value={
            balance != null ? `${ethers.utils.formatEther(balance)} ETH` : "–"
          }
        />
        <LabeledRow
          label="Transaction count"
          value={transactionCount != null ? String(transactionCount) : "–"}
        />
        <ActiveWalletConnectSessions />
        <WalletConnectInputView />
      </>
    );
  }

  return (
    <ScrollContainer
      onRefresh={async () => {
        await walletQuery.mutate(undefined);
      }}
    >
      <View style={styles.root}>{content}</View>
    </ScrollContainer>
  );
}

function ActiveWalletConnectSessions() {
  const { web3wallet, isInitialized } = useWalletConnectV2Context();
  const [activeSessions, setActiveSessions] = React.useState<any[]>([]);

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

  if (!isInitialized || activeSessions.length === 0) {
    return null;
  }

  return (
    <View style={styles.sessionsContainer}>
      <Text style={styles.sessionsTitle}>
        🔗 Connected dApps ({activeSessions.length})
      </Text>
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
              {truncateAddress(session.topic)}
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
  );
}

function SettingsLink() {
  const navigation = useTypedNavigation();

  return (
    <View style={styles.buttonGroup}>
      <Button
        title="Update credentials"
        onPress={() => {
          navigation.navigate("settings");
        }}
      />
    </View>
  );
}

function NetworkRow() {
  const { showActionSheetWithOptions } = useActionSheet();
  const { network: currentNetwork, setNetwork } = useTurnkeyWalletContext();

  return (
    <LabeledRow
      auxiliary="Tap to change"
      label="Current network"
      value={getNetworkDisplayValue(currentNetwork)}
      onValuePress={() => {
        const displayList = networkList.map(getNetworkDisplayValue);

        const options = [...displayList, "Cancel"];
        const cancelButtonIndex = options.length - 1;

        showActionSheetWithOptions(
          {
            options: options,
            cancelButtonIndex,
          },
          (selectedIndex) => {
            if (selectedIndex == null || selectedIndex === cancelButtonIndex) {
              return;
            }

            const selectedNetwork = networkList[selectedIndex];
            if (
              !networkList.includes(selectedNetwork) ||
              selectedNetwork === currentNetwork
            ) {
              return;
            }

            setNetwork(selectedNetwork);
          }
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  buttonGroup: {
    padding: 4,
  },
  sessionsContainer: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
