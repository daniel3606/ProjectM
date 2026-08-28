/**
 * Minimal analytics façade.
 *
 * The app doesn't ship an analytics SDK yet, so `track` buffers events and
 * hands them to whatever transport gets installed via `setAnalyticsTransport`
 * (Amplitude, PostHog, a Supabase table — the call sites don't care). Events
 * fired before a transport exists are replayed in order once one arrives, so
 * early-launch events like `onboarding_started` aren't lost.
 */

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsEventName =
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_goal_selected"
  | "onboarding_age_range_selected"
  | "onboarding_current_screentime_set"
  | "onboarding_target_screentime_set"
  | "onboarding_reclaimed_time_viewed"
  | "onboarding_customization_completed"
  | "screentime_permission_requested"
  | "screentime_permission_granted"
  | "screentime_permission_denied"
  | "distracting_apps_selected"
  | "schedule_created_from_onboarding"
  | "schedule_skipped"
  | "signup_started"
  | "signup_completed"
  | "onboarding_completed"
  | "onboarding_abandoned"
  | "first_focus_session_started";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props?: AnalyticsProps;
  /** Wall-clock time the event happened, so replayed events keep their real timing. */
  timestamp: number;
}

export type AnalyticsTransport = (event: AnalyticsEvent) => void;

/** Cap on replay buffering, so a build that never installs a transport can't grow unbounded. */
const MAX_BUFFERED_EVENTS = 100;

let transport: AnalyticsTransport | null = null;
let buffer: AnalyticsEvent[] = [];

function deliver(event: AnalyticsEvent) {
  try {
    transport?.(event);
  } catch {
    // A failing transport must never break a user flow.
  }
}

/** Installs the sink for all future (and buffered) events. */
export function setAnalyticsTransport(next: AnalyticsTransport | null): void {
  transport = next;
  if (!next) return;
  const pending = buffer;
  buffer = [];
  for (const event of pending) deliver(event);
}

export function track(name: AnalyticsEventName, props?: AnalyticsProps): void {
  const event: AnalyticsEvent = { name, props, timestamp: Date.now() };

  if (!transport) {
    buffer.push(event);
    if (buffer.length > MAX_BUFFERED_EVENTS) buffer.shift();
    return;
  }

  deliver(event);
}

/** Test seam — drops the transport and any buffered events. */
export function resetAnalytics(): void {
  transport = null;
  buffer = [];
}
