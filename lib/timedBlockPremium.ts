import type { FocusMode } from "@/constants/marshmallow";
import type { BlockMode } from "@/modules/screen-time";

/**
 * Premium-only settings stored on a scheduled plan. A lapsed account keeps
 * the saved values but they must not take effect until Premium is active again.
 */
export function scheduledBlockIsHard(
  plan: { focusMode: FocusMode },
  isPremium: boolean
): boolean {
  return isPremium && plan.focusMode === "deep";
}

export function scheduledBlockMode(
  plan: { blockMode?: BlockMode },
  isPremium: boolean
): BlockMode {
  return isPremium && plan.blockMode === "allowOnly" ? "allowOnly" : "block";
}
