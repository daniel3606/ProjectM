import { requireNativeModule } from "expo-modules-core";

type ScreenTimeNativeModule = {
  isAvailable: () => boolean;
  getAuthorizationStatus: () => string;
  requestAuthorization: () => Promise<boolean>;
  openAppPicker: () => Promise<unknown>;
  getSelectedItems: () => Promise<unknown>;
  applyBlocking: (itemIds: string[]) => Promise<void>;
  blockAll: () => Promise<void>;
  clearBlocking: () => Promise<void>;
  clearSelection: () => Promise<void>;
  scheduleTimedBlocks: (plans: unknown[]) => Promise<void>;
  clearScheduledBlocks: () => Promise<void>;
  getActiveNativeBlock: () => Promise<unknown>;
  setActiveNativeBlock: (block: Record<string, unknown>) => Promise<void>;
  clearActiveNativeBlock: () => Promise<void>;
  setMarshmallowSizeCm: (sizeCm: number) => void;
  setMarshmallowColorHex: (hex: string) => void;
  setMarshmallowItems: (items: Record<string, string>) => void;
  startQuickBlockLiveActivity: (params: Record<string, unknown>) => Promise<boolean>;
  endQuickBlockLiveActivity: () => Promise<void>;
};

let ScreenTimeModule: ScreenTimeNativeModule;

try {
  ScreenTimeModule = requireNativeModule("ScreenTimeModule") as ScreenTimeNativeModule;
} catch {
  const noop = async () => {};
  ScreenTimeModule = {
    isAvailable: () => false,
    getAuthorizationStatus: () => "unavailable",
    requestAuthorization: async () => false,
    openAppPicker: async () => null,
    getSelectedItems: async () => [],
    applyBlocking: noop,
    blockAll: noop,
    clearBlocking: noop,
    clearSelection: noop,
    scheduleTimedBlocks: noop,
    clearScheduledBlocks: noop,
    getActiveNativeBlock: async () => null,
    setActiveNativeBlock: noop,
    clearActiveNativeBlock: noop,
    setMarshmallowSizeCm: () => {},
    setMarshmallowColorHex: () => {},
    setMarshmallowItems: () => {},
    startQuickBlockLiveActivity: async () => false,
    endQuickBlockLiveActivity: noop,
  };
}

export default ScreenTimeModule;
