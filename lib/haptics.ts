import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * The app's whole haptic vocabulary, deliberately three notches wide.
 *
 * Keeping the set this small is the point: it's what stops feedback from
 * creeping onto every transition and button. Anything that isn't a selection,
 * a physical increment, or a genuinely important moment gets no haptic at all.
 *
 * iOS routes these through UIFeedbackGenerator, which already honours the
 * system Haptics setting, so there's nothing extra to check there.
 */

let enabled = Platform.OS !== "web";

/** Lets a future settings toggle silence feedback app-wide. */
export function setHapticsEnabled(next: boolean): void {
  enabled = next && Platform.OS !== "web";
}

/** Picking an option, or crossing a meaningful increment on a slider. */
export function hapticSelection(): void {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/** A small confirmation: a customization change, a step beginning. */
export function hapticLight(): void {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Reserved for moments that actually matter — the reclaimed-time result
 * landing, the marshmallow visibly growing, an important setup step finishing.
 */
export function hapticEmphasis(): void {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
