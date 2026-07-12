import { useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";

/**
 * Fires a light selection tick whenever `selectionKey` changes, skipping the
 * initial mount so mounting the screen doesn't itself trigger a vibration.
 */
export default function useSelectionHaptic(
  selectionKey: string | number,
  enabled: boolean = true,
) {
  const previousKeyRef = useRef<string | number | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      previousKeyRef.current = selectionKey;
      return;
    }

    if (enabled && selectionKey !== previousKeyRef.current) {
      Haptics.selectionAsync().catch(() => {});
    }
    previousKeyRef.current = selectionKey;
  }, [selectionKey, enabled]);
}
