# Turnkey Demo: Consumer Wallet

## Introduction

This repository features a minimal consumer wallet app powered by Turnkey. Behind the scenes, it uses [`@turnkey/ethers`](https://www.npmjs.com/package/@turnkey/ethers) for signing and WalletConnect (v1 & v2) for accessing dapps.

With Turnkey, you can easily build wallet apps leveraging the existing ecosystem; `TurnkeySigner` is a drop-in replacement for `ethers.Wallet`, but with fine-grained transaction controls via [Turnkey policies](https://docs.turnkey.com/managing-policies/quickstart), all without compromising on security.

https://github.com/tkhq/demo-consumer-wallet/assets/127255904/2c3409df-2d7c-4ec3-9aa8-e2944a0b0e0a

## Getting started

Make sure you have Node.js installed locally; we recommend using Node v16+.

```bash
$ node --version # v16+
$ git clone https://github.com/tkhq/demo-consumer-wallet
$ cd demo-consumer-wallet/
$ corepack enable # Updates npm for the local project

$ npm install
$ npm start # Follow the instructions on screen to build to your device or a simulator

# Or run directly on web (for testing only)
$ npm run web
```

To configure the demo passkey wallet you'll need the following:
* A Turnkey organization ID: you can create one by following our [quickstart guide](https://docs.turnkey.com/getting-started/quickstart).
* A new Turnkey API key (public/private key pair). You can generate one using [our CLI](https://github.com/tkhq/tkcli), or through the Turnkey dashboard
* Turnkey's base URL: you can leave the default of `https://api.turnkey.com`.
* A Turnkey "Sign With" value: This can be a wallet address, wallet ID, or private key ID. Head to your Turnkey dashboard to get a wallet address or private key that you want to use for signing transactions.
* An account on [Infura](https://www.infura.io/) (optional for networks like Base and Hyperliquid that use custom RPCs) and a block explorer API key (Etherscan, Basescan, etc.)

### Quick Setup with Environment Variables

You can optionally use environment variables for development:

```bash
cp .env.development.local.example .env.development.local
# Edit the file with your credentials
npm start
```

You'll provide this information on first app start in the settings screen:

<img src="screenshots/wallet_settings.png" alt="Wallet settings" width="300px" />

Upon clicking "Save" the settings are saved in your phone's keychain and  you should see your wallet address and ETH balance:

 <img src="screenshots/wallet_home.png" alt="Wallet home" width="300px" />

## Technical tl;dr

Turnkey API keys and other credentials are encrypted and stored in your phone's Keychain: https://github.com/tkhq/demo-consumer-wallet/blob/14f7e5535c453ab9990373e0dff61165329be15b/src/turnkey/CredentialsContext.tsx#L111

Create a [`TurnkeySigner`](https://github.com/tkhq/sdk/tree/main/packages/ethers), bring your own provider, then bridge it via EIP-1193:
https://github.com/tkhq/demo-consumer-wallet/blob/14f7e5535c453ab9990373e0dff61165329be15b/src/turnkey/TurnkeyWalletContext.tsx#L73-L85

WalletConnect payloads are signed by Turnkey and broadcasted by your provider, all via the bridge:
https://github.com/tkhq/demo-consumer-wallet/blob/14f7e5535c453ab9990373e0dff61165329be15b/src/screens/WalletConnectScreen.tsx#L222-L225

## Platform Support

- **iOS & Android**: Full production support with secure keychain storage
- **Web**: Development/testing only - credentials stored in localStorage (not encrypted)
  - Quick start: `npm run web`
  - ⚠️ Use testnet credentials only on web!

## What's New

- ✅ **WalletConnect v2** - Full support with auto-detection (v1 & v2 work simultaneously)
  - **Chain-agnostic** - Automatically uses the correct chain for each dApp request
  - **Session persistence** - Connections survive app minimization/closing
  - **Home page session management** - View and manage all active dApp connections from home screen
  - **Disconnect button** - Manually disconnect from dApps with confirmation
  - **No navigation needed** - See all connections without leaving the home page
- ✅ Migrated from `TURNKEY_PRIVATE_KEY_ID` to flexible `SIGN_WITH` parameter
- ✅ Added Base network support (Base Mainnet & Base Sepolia)
- ✅ Added Hyperliquid mainnet support
- ✅ Web platform support for development/testing
- ✅ Environment variable configuration support
- ✅ 12+ supported networks including Ethereum, Polygon, Optimism, Arbitrum, Base, and Hyperliquid

See `CHANGELOG.md` for complete list of changes.
