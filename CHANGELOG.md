# Changelog

## [Unreleased] - 2025-10-23

### Added

#### WalletConnect v2 Support 🎉
- **Full WalletConnect v2 implementation** with automatic version detection
- **Dual version support**: Both v1 and v2 work simultaneously
- **Smart routing**: Automatically routes to correct handler based on URI
- **New v2 features**:
  - Session proposals with approval/rejection
  - Transaction signing (eth_sendTransaction)
  - Message signing (personal_sign)
  - Typed data signing (eth_signTypedData_v4)
  - **Multi-chain support** - chain-agnostic transactions
  - **Dynamic chain switching** - automatically uses the correct chain for each request
  - **Session persistence** - sessions survive app minimization/closing
  - **Home page session management** - view and disconnect active sessions directly from home screen
  - Relay-based communication
- **Project ID configuration**: Added `WALLETCONNECT_PROJECT_ID` to settings
- **Visual indicators**: Badges show which version is being used
- **Created** `WalletConnectV2Context` for v2 state management
- **Created** `WalletConnectV2Screen` for v2 connections
- **Disconnect button** - manually disconnect from dApps with confirmation dialog
- **Active sessions on home** - shows all connected dApps with names, URLs, and topics on the main screen
- **No navigation needed** - manage all connections without leaving the home page

#### Web Platform Support
- **Web version enabled**: The wallet can now run in web browsers in addition to iOS and Android
- Added `npm run web` command for easy web development
- Installed web dependencies: `react-native-web`, `react-dom`, `@expo/webpack-config`
- Created comprehensive web support documentation
- Added webpack configuration with Node.js polyfills for crypto operations
- Environment variables now load correctly in web builds

⚠️ **Web Security Notice**: The web version uses localStorage (not encrypted) and should only be used for development and testing with testnet credentials. Not recommended for production use with real funds.

#### Hyperliquid Network Support
- **Hyperliquid Mainnet** added (Chain ID: 998)
- Custom RPC: `https://api.hyperliquid.xyz/evm`
- Block explorer: `https://app.hyperliquid.xyz/explorer/`

#### Environment Variables Support
- Added `.env.development.local` support for easier configuration
- Created `ENV_SETUP.md` documentation
- Webpack configured to inject environment variables in web builds
- Both mobile and web now support environment variable loading

### Changed

#### Major Updates
- **Migrated from `TURNKEY_PRIVATE_KEY_ID` to `SIGN_WITH`**: The app now uses the more flexible `signWith` parameter for Turnkey authentication, allowing users to provide wallet addresses, wallet IDs, or private key IDs.

#### Network Support
- **Added Base Network Support**: 
  - Base Mainnet (chain ID: 8453)
  - Base Sepolia Testnet (chain ID: 84532)
- **Added Hyperliquid Network Support**:
  - Hyperliquid Mainnet (chain ID: 998)
- Enhanced network switching to support custom RPC endpoints for non-Infura networks
- Total of 12 supported networks across multiple L1s and L2s

#### Dependencies
- Updated `@turnkey/api-key-stamper` from ~0.1.1 to ~0.4.3
- Updated `@turnkey/ethers` from ~0.17.1 to ~0.19.9
- Updated `@turnkey/http` from ~1.2.0 to ~2.7.1
- **Added** `@walletconnect/web3wallet@^1.16.1` for v2 support
- **Added** `@walletconnect/core@^2.17.1` for v2 core functionality
- **Added** `@walletconnect/utils@^2.17.1` for v2 utilities
- **Added** `@react-native-async-storage/async-storage@^1.24.0` (required for WalletConnect v2 storage)
- **Added** `core-js@^3.x` (polyfills for Map/Set iterators needed by WalletConnect v2)

#### UI Updates
- Settings screen now shows "SIGN_WITH" instead of "TURNKEY_PRIVATE_KEY_ID"
- Home screen updated to display "Sign With" label
- Network selector now includes Base and Base Sepolia options

#### Infrastructure
- Added custom RPC provider support for networks not supported by Infura
- Implemented network-specific block explorer mappings
- Added support for Basescan block explorer

### Fixed

#### WalletConnect v2 Issues
- **Fixed** "i.entries is not a function" error when pairing with WalletConnect v2
  - Added `core-js` polyfills for Map/Set iterator methods
  - Updated `src/applyShimsAsap.ts` with required polyfills
- **Fixed** "Unauthorized: invalid key" error with WalletConnect Project ID
  - Now reads Project ID from credentials context first, then environment
  - Added better error messages and logging
  - Reinitializes when Project ID is updated in settings

#### Etherscan API
- **Upgraded** Etherscan API implementation to be more robust and maintainable
  - Created new `fetchEtherscanApi()` and `getTransactionHistory()` utilities
  - Added direct API calls with better error handling
  - Added support for all networks including Base and Hyperliquid
  - Ready for future Etherscan API v2 when released
  - Backward compatible with automatic fallback to ethers.js provider

### Technical Details

#### Files Modified
1. `src/turnkey/CredentialsContext.tsx` - Updated credentials type and key list
2. `src/turnkey/TurnkeyWalletContext.tsx` - Refactored to use `signWith` and support custom RPC
3. `src/turnkey/TurnkeyQuery.ts` - Updated to use new Etherscan API utilities
4. `src/screens/HomeScreen.tsx` - Updated UI labels and network list
5. `src/utils.ts` - Added Etherscan API utilities and network-specific explorer URLs
6. `src/walletconnect/WalletConnectV2Context.tsx` - Fixed Project ID loading from credentials
7. `src/applyShimsAsap.ts` - Added core-js polyfills for Map/Set iterators
8. `package.json` - Updated dependencies (Turnkey SDK, WalletConnect v2, core-js)
9. `README.md` - Updated configuration instructions

#### New Files
- `CHANGELOG.md` - This file
- `webpack.config.js` - Webpack configuration for web builds
- `src/walletconnect/WalletConnectV2Context.tsx` - v2 context provider
- `src/screens/WalletConnectV2Screen.tsx` - v2 screen implementation
- `.env.development.local.example` - Template for environment variables (blocked by .gitignore)

### Breaking Changes

⚠️ **Important**: This update requires users to reconfigure their Turnkey credentials:

- The `TURNKEY_PRIVATE_KEY_ID` field has been replaced with `SIGN_WITH`
- Existing users will need to re-enter their credentials in the Settings screen
- If you were using a private key ID before, you can enter the same value in the `SIGN_WITH` field

### Network Configuration

#### Custom RPC Endpoints
```
base: https://mainnet.base.org
base-sepolia: https://sepolia.base.org
```

#### Block Explorer URLs
- Base Mainnet: https://basescan.org/
- Base Sepolia: https://sepolia.basescan.org/
- (Plus all existing Etherscan, Polygonscan, Arbiscan, etc.)

### Migration Instructions

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions.

### Backwards Compatibility

The `SIGN_WITH` parameter accepts the same private key IDs that were used with `TURNKEY_PRIVATE_KEY_ID`, ensuring backwards compatibility for existing users who want to continue using their private key IDs.

### Platform Support

| Platform | Status | Production Ready | Notes |
|----------|--------|------------------|-------|
| iOS | ✅ Supported | ✅ Yes | Full features with secure keychain |
| Android | ✅ Supported | ✅ Yes | Full features with secure keychain |
| Web | ✅ Supported | ⚠️ Testing only | localStorage (not encrypted) |

### Future Enhancements

Potential future additions:
- More Layer 2 networks (Zora, Mode, etc.)
- Custom RPC endpoint configuration
- Enhanced transaction history for Base networks
- Web-specific security improvements (Passkeys, iframe embedding)
- Progressive Web App (PWA) support
- Session-based authentication for web

