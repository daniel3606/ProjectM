import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "marshmallow.";

/**
 * Like useState, but persisted to AsyncStorage under `marshmallow.<key>`.
 * Skips writing until the initial load finishes, so the default value
 * doesn't clobber whatever was already stored.
 */
export function usePersistedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY_PREFIX + key).then((raw) => {
      if (cancelled) return;
      if (raw != null) {
        try {
          setValue(JSON.parse(raw) as T);
        } catch {
          // Ignore corrupt stored value, keep default.
        }
      }
      loaded.current = true;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
