// Jest setup for auth utility tests.

// Anything importing lib/storage pulls in AsyncStorage, whose native module
// isn't present under Jest. The library ships an in-memory stand-in for this.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-iap", () => ({
  useIAP: () => ({
    connected: false,
    subscriptions: [],
    activeSubscriptions: [],
    fetchProducts: jest.fn(async () => undefined),
    requestPurchase: jest.fn(async () => undefined),
    finishTransaction: jest.fn(async () => undefined),
    getActiveSubscriptions: jest.fn(async () => undefined),
    restorePurchases: jest.fn(async () => undefined),
  }),
  getActiveSubscriptions: jest.fn(async () => []),
  deepLinkToSubscriptions: jest.fn(async () => undefined),
}));
