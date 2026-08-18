import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "marshmallow.";

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
