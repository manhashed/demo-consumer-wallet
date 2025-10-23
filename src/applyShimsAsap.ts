import "react-native-get-random-values";
import "@ethersproject/shims";
import "fast-text-encoding"; // + `TextEncoder` / `TextDecoder`
import "react-native-url-polyfill/auto"; // URL polyfill

// WalletConnect v2 polyfills for iterators (Map.entries, Set.entries, etc.)
import "core-js/features/map";
import "core-js/features/set";
import "core-js/features/symbol";
import "core-js/features/promise";

if (typeof Buffer === "undefined") {
  globalThis.Buffer = require("buffer").Buffer;
}

// Use a `WebCrypto` polyfill because
// `crypto-browserify` doesn't support `crypto.createPrivateKey(...)`
const { Crypto } = require("@peculiar/webcrypto");
globalThis.crypto = new Crypto();
