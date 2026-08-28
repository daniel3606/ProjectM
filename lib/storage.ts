import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "marshmallow.";

/**
 * Keys that describe this device rather than the person signed in on it.
 * Everything else under `marshmallow.` is one account's data — progress,
 * appearance, entitlements — and must not follow a sign-out into the next
 * account. New keys are user-scoped unless they are listed here.
 *
 * Having watched the opening animation belongs to whoever is holding the
 * phone. Having finished onboarding does not: an account owns its own setup,
 * so that flag leaves with the account that earned it.
 */
const DEVICE_SCOPED_KEYS = new Set(["onboarding.seenIntro"]);

/** Exported for tests: decides what `clearUserScopedState` removes. */
export function isUserScopedKey(storageKey: string): boolean {
  if (!storageKey.startsWith(KEY_PREFIX)) return false;
  return !DEVICE_SCOPED_KEYS.has(storageKey.slice(KEY_PREFIX.length));
}

/**
 * Drops the signed-in user's persisted state. The prefix check keeps this off
 * Supabase's own session keys, which live under their own namespace.
 */
export async function clearUserScopedState(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const owned = keys.filter(isUserScopedKey);
  if (owned.length > 0) await AsyncStorage.multiRemove(owned);
}

/**
 * Like useState, but persisted to AsyncStorage under `marshmallow.<key>`.
 * Skips writing until the initial load finishes, so the default value
 * doesn't clobber whatever was already stored.
 * If the caller updates the value before storage loads (e.g. a remote
 * hydrate), that update wins and the stale stored value is ignored.
 */
export function usePersistedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const overriddenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY_PREFIX + key).then((raw) => {
      if (cancelled) return;
      if (!overriddenRef.current && raw != null) {
        try {
          setValue(JSON.parse(raw) as T);
        } catch {
          // Ignore corrupt stored value, keep default.
        }
      }
      loadedRef.current = true;
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setAndMark = useCallback((next: SetStateAction<T>) => {
    overriddenRef.current = true;
    setValue(next);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  }, [key, value, loaded]);

  return [value, setAndMark, loaded] as const;
}
