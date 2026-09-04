import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePersistedState } from "@/lib/storage";
import { computeMarshmallowSizeCm, type FocusMode } from "@/constants/marshmallow";
import {
  computeSessionGrowth,
  getRawGrowthToday,
  getStreakDays,
  roundGrowthCm,
  type GrowthBlockType,
} from "@/lib/growthModel";
import {
  notifyBlockEnded,
  scheduleBlockEndNotification,
  cancelBlockEndNotification,
} from "@/lib/notifications";
import {
  INITIAL_BREAK_STATE,
  endBreak as computeEndBreak,
  getBreakAvailability,
  isOnBreak,
  startBreak as computeStartBreak,
  type BreakAvailability,
  type BreakState,
} from "@/lib/focusBreaks";
import { syncCompletedSession, fetchRemoteSessions } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import * as ScreenTime from "@/modules/screen-time";
import type { SessionAttempt } from "@/lib/stats/types";
import type { BlockMode } from "@/modules/screen-time";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface FocusSessionConfig {
  durationMinutes: number;
  focusMode: FocusMode;
  expectedGrowthCm: number;
  /** App/category/web IDs to block; empty means block everything. */
  appIds?: string[];
  /**
   * Whether `appIds` lists what to block or the only things left open.
   * Defaults to "block" for sessions saved before this existed.
   */
  blockMode?: BlockMode;
  /** Hard Mode blocks can't be ended early and earn no breaks. */
  isHardMode?: boolean;
  /**
   * Which growth multiplier the block earns. Absent on sessions saved before
   * the growth model existed; those are read as Quick Blocks.
   */
  blockType?: GrowthBlockType;
  /** Set when this session was auto-started by a Timed Block plan rather than manually. */
  planId?: string;
  /**
   * Scheduled start of the plan window this run belongs to. Identifies the run
   * to the scheduler, which `startedAt` no longer can: a window joined
   * part-way through starts blocking later than it was scheduled to.
   */
  occurrenceStartsAt?: number;
  /** Plan label, used to personalize the auto-dismiss notification for Timed Block sessions. */
  label?: string;
}

export interface ActiveSession extends FocusSessionConfig {
  startedAt: number;
  /** Absent on sessions started before breaks existed; treated as unused. */
  breakState?: BreakState;
}

export interface CompletedSession extends FocusSessionConfig {
  completedAt: number;
  /**
   * What the block earned before the daily soft cap. The rest of the day is
   * priced against this, not against the award.
   */
  rawGrowthCm?: number;
  /** What the marshmallow actually grew by. Absent on pre-model history. */
  awardedGrowthCm?: number;
}

export interface PendingGrowthResult {
  growthCm: number;
  durationMinutes: number;
  focusMode: FocusMode;
  label?: string;
}

/** The day-dependent half of a growth estimate; the block itself supplies the rest. */
export interface GrowthPreview {
  streakDays: number;
  rawGrowthTodayCm: number;
}

const MAX_HISTORY = 50;

/**
 * Attempts feed Stats, which looks back further than the growth history does
 * and needs the blocks that were ended early as much as the ones that weren't.
 */
const MAX_ATTEMPTS = 400;

interface FocusSessionContextValue {
  activeSession: ActiveSession | null;
  /** False until the persisted session has been read. Gate anything that would
   *  otherwise treat "not loaded yet" as "no block running". */
  isSessionLoaded: boolean;
  history: CompletedSession[];
  /** Every block the user started, completed or not. Powers Stats. */
  attempts: SessionAttempt[];
  pendingGrowthResult: PendingGrowthResult | null;
  /** Streak and day-so-far raw growth, for previewing what a block would earn. */
  growthPreview: GrowthPreview;
  /** `startedAt` defaults to now; pass it explicitly to pin a session to when blocking really began. */
  startSession: (config: FocusSessionConfig, startedAt?: number) => void;
  stopSession: () => void;
  /** Patches the running session in place (e.g. duration/growth from an edit) without resetting `startedAt`. No-op if nothing is active. */
  updateSession: (patch: Partial<Omit<ActiveSession, "startedAt">>) => void;
  clearPendingGrowthResult: () => void;
  /** True while a break is unblocking apps mid-session. */
  isOnBreak: boolean;
  /** Whether a break can be taken right now, and why not when it can't. */
  breakAvailability: BreakAvailability | null;
  /** Unblocks apps for the break length. No-op unless `breakAvailability.canTakeBreak`. */
  startBreak: () => void;
  /** Re-applies the block, ending the break early. No-op when not on a break. */
  endBreak: () => void;
}

const FocusSessionContext = createContext<FocusSessionContextValue | null>(null);

export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession, activeSessionLoaded] = usePersistedState<ActiveSession | null>(
    "focusSession.active",
    null
  );
  const [history, setHistory] = usePersistedState<CompletedSession[]>(
    "focusSession.history",
    []
  );
  const [attempts, setAttempts] = usePersistedState<SessionAttempt[]>(
    "focusSession.attempts",
    []
  );
  const [pendingGrowthResult, setPendingGrowthResult] =
    usePersistedState<PendingGrowthResult | null>("focusSession.pendingGrowthResult", null);
  const presenceRef = useRef<RealtimeChannel | null>(null);
  const endNotificationIdRef = useRef<string | null>(null);

  // Read by `stopSession` for the day's raw growth and the streak. A ref, not a
  // dependency: `stopSession` must keep a stable identity or the auto-end timer
  // effect below re-arms every time a session lands in history.
  const historyRef = useRef(history);
  historyRef.current = history;

  // Broadcast focus presence when session starts/stops
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;

      // Clean up previous channel
      if (presenceRef.current) {
        await presenceRef.current.untrack();
        supabase.removeChannel(presenceRef.current);
        presenceRef.current = null;
      }

      if (activeSession) {
        const channel = supabase.channel("focus-presence", {
          config: { presence: { key: session.user.id } },
        });

        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            await channel.track({
              isFocusing: true,
              focusMode: activeSession.focusMode,
              startedAt: activeSession.startedAt,
            });
          }
        });

        presenceRef.current = channel;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSession]);

  // Mirrors activeSession into the App Group so the MarshmallowWidget
  // extension can show a remaining-time countdown without the app running.
  // Covers Quick Block start, Timed Block adoption, and updateSession edits
  // uniformly, since all of them funnel through this same state.
  useEffect(() => {
    if (activeSession) {
      ScreenTime.setActiveNativeBlock({
        planId: activeSession.planId,
        startedAt: activeSession.startedAt,
        durationMinutes: activeSession.durationMinutes,
        label: activeSession.label ?? "Focus Block",
        expectedGrowthCm: activeSession.expectedGrowthCm,
      }).catch(() => {});
    } else {
      ScreenTime.clearActiveNativeBlock().catch(() => {});
    }
  }, [activeSession]);

  // Keeps the widget's marshmallow size in sync with history-derived size.
  useEffect(() => {
    ScreenTime.setMarshmallowSizeCm(computeMarshmallowSizeCm(history));
  }, [history]);

  // Hydrate session history from Supabase for whoever is signed in.
  //
  // An empty result leaves local history alone: that is a brand-new account
  // adopting the marshmallow made before signing up, not an account whose
  // progress should be erased. A previous user's history can't be here to
  // leak — signing out clears it (see `clearUserScopedState`).
  //
  // Read from Supabase rather than useAuth: lib/sync takes its CompletedSession
  // type from this file, so importing AuthContext here would close an import
  // cycle and leave its hooks undefined at module init.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async (userId: string) => {
      const remoteSessions = await fetchRemoteSessions(userId).catch(() => []);
      if (cancelled || remoteSessions.length === 0) return;
      setHistory(remoteSessions);
    };

    // A session restored at launch arrives as INITIAL_SESSION, and a remount
    // after sign-out has already missed whatever event fired. Neither reaches
    // the SIGNED_IN listener below, so ask for the session directly too.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session?.user) void hydrate(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) void hydrate(session.user.id);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setHistory]);

  const startSession = useCallback(
    (config: FocusSessionConfig, startedAt: number = Date.now()) => {
      setActiveSession({ ...config, startedAt, breakState: INITIAL_BREAK_STATE });
    },
    [setActiveSession]
  );

  const updateSession = useCallback(
    (patch: Partial<Omit<ActiveSession, "startedAt">>) => {
      setActiveSession((current) => (current ? { ...current, ...patch } : current));
    },
    [setActiveSession]
  );

  const clearPendingGrowthResult = useCallback(() => {
    setPendingGrowthResult(null);
  }, [setPendingGrowthResult]);

  // ── Breaks ────────────────────────────────────────────────────────────
  // A break lifts the shields for a few minutes without touching the session
  // clock, so the block still pays out its full growth. Policy (how many,
  // how long, how much friction) lives in lib/focusBreaks.
  const breakState = activeSession?.breakState ?? INITIAL_BREAK_STATE;

  // Bumped when a timing gate passes, so availability recomputes without
  // polling every second in a provider the whole tree consumes.
  const [breakTick, setBreakTick] = useState(0);

  const breakAvailability = useMemo(() => {
    if (!activeSession) return null;
    return getBreakAvailability({
      startedAt: activeSession.startedAt,
      durationMinutes: activeSession.durationMinutes,
      isHardMode: !!activeSession.isHardMode,
      breakState,
      now: Date.now(),
    });
    // `breakTick` is intentionally a dependency: it is the recompute signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, breakState, breakTick]);

  // Wakes up exactly when the break button unlocks. `availableAt` is only
  // returned while the gate is still closed, so this can't loop.
  useEffect(() => {
    const availableAt = breakAvailability?.availableAt;
    if (availableAt == null) return;
    const delay = availableAt - Date.now();
    if (delay <= 0) {
      setBreakTick((tick) => tick + 1);
      return;
    }
    const timer = setTimeout(() => setBreakTick((tick) => tick + 1), delay + 250);
    return () => clearTimeout(timer);
  }, [breakAvailability]);

  const endBreak = useCallback(() => {
    if (activeSession?.breakState?.breakEndsAt == null) return;
    const now = Date.now();
    const sessionEndsAt =
      activeSession.startedAt + activeSession.durationMinutes * 60_000;
    // Re-shielding a block that has already elapsed would leave the shield up
    // with no session to lift it, so past the end we only clear break state.
    if (now < sessionEndsAt) {
      ScreenTime.applyBlockMode(
        activeSession.blockMode ?? "block",
        activeSession.appIds ?? []
      ).catch(() => {});
    }
    setActiveSession((current) =>
      current?.breakState
        ? { ...current, breakState: computeEndBreak(current.breakState, now) }
        : current
    );
  }, [activeSession, setActiveSession]);

  const startBreak = useCallback(() => {
    if (!activeSession) return;
    const now = Date.now();
    const current = activeSession.breakState ?? INITIAL_BREAK_STATE;
    const availability = getBreakAvailability({
      startedAt: activeSession.startedAt,
      durationMinutes: activeSession.durationMinutes,
      isHardMode: !!activeSession.isHardMode,
      breakState: current,
      now,
    });
    if (!availability.canTakeBreak) return;

    const endsAt = activeSession.startedAt + activeSession.durationMinutes * 60_000;
    ScreenTime.clearBlocking().catch(() => {});
    setActiveSession((session) =>
      session ? { ...session, breakState: computeStartBreak(current, now, endsAt) } : session
    );
  }, [activeSession, setActiveSession]);

  // Re-shields the moment the break's time is up, including after a cold
  // launch mid-break (the timeout is re-armed from the persisted end time).
  useEffect(() => {
    const breakEndsAt = activeSession?.breakState?.breakEndsAt;
    if (breakEndsAt == null) return;
    const delay = breakEndsAt - Date.now();
    if (delay <= 0) {
      endBreak();
      return;
    }
    const timer = setTimeout(endBreak, delay);
    return () => clearTimeout(timer);
  }, [activeSession, endBreak]);

  // The one place a block's growth is priced. Both the completion path and the
  // "Block Ended" notification call it with the same inputs, so the number the
  // user is told is the number the marshmallow gets.
  const awardGrowthFor = useCallback(
    (session: FocusSessionConfig, endedAt: number) =>
      computeSessionGrowth({
        minutes: session.durationMinutes,
        blockType: session.blockType ?? "quick",
        isHardBlock: !!session.isHardMode,
        streakDays: getStreakDays(historyRef.current, endedAt),
        completed: true,
        rawGrowthTodayCm: getRawGrowthToday(historyRef.current, endedAt),
      }),
    []
  );

  const stopSession = useCallback(() => {
    ScreenTime.clearBlocking().catch(() => {});
    ScreenTime.clearActiveNativeBlock().catch(() => {});

    // Cancel the scheduled end notification — the foreground path handles it.
    cancelBlockEndNotification(endNotificationIdRef.current);
    endNotificationIdRef.current = null;

    // Untrack presence
    if (presenceRef.current) {
      presenceRef.current.untrack().catch(() => {});
      supabase.removeChannel(presenceRef.current);
      presenceRef.current = null;
    }

    setActiveSession((current) => {
      if (current) {
        const endedAt = Date.now();
        const endsAt = current.startedAt + current.durationMinutes * 60_000;
        const ranFullDuration = endedAt >= endsAt;

        // Logged whatever the outcome — Stats needs the abandoned blocks to
        // report a completion rate at all, and the minutes served before an
        // early stop were still minutes the user spent focused.
        const focusedMinutes = ranFullDuration
          ? current.durationMinutes
          : Math.max(
              0,
              Math.min(
                current.durationMinutes,
                Math.round((endedAt - current.startedAt) / 60_000)
              )
            );
        // Ended early (cancelled, or the underlying plan changed mid-window):
        // no growth, and it doesn't count as a completed session. A Hard Block
        // exited this way earns no Hard Block bonus either.
        //
        // Priced now rather than at start. A block that runs past midnight is
        // charged against the new day's soft cap, which the estimate shown
        // when it began could not know.
        const award = ranFullDuration ? awardGrowthFor(current, endedAt) : null;
        const growthCm = award ? roundGrowthCm(award.awardedGrowthCm) : 0;

        setAttempts((prev) =>
          [
            ...prev,
            {
              startedAt: current.startedAt,
              endedAt,
              durationMinutes: current.durationMinutes,
              focusedMinutes,
              focusMode: current.focusMode,
              completed: ranFullDuration,
              planId: current.planId,
              planLabel: current.label,
              appIds: current.appIds,
              growthCm,
            } satisfies SessionAttempt,
          ].slice(-MAX_ATTEMPTS)
        );

        if (award) {
          const { startedAt, ...config } = current;
          const { rawGrowthCm, awardedGrowthCm } = award;

          const completed: CompletedSession = {
            ...config,
            completedAt: endedAt,
            expectedGrowthCm: growthCm,
            rawGrowthCm,
            awardedGrowthCm,
          };
          setHistory((prev) =>
            [completed, ...prev].slice(0, MAX_HISTORY)
          );
          setPendingGrowthResult({
            growthCm,
            durationMinutes: current.durationMinutes,
            focusMode: current.focusMode,
            label: current.label,
          });
          // Fire-and-forget sync to Supabase
          syncCompletedSession(completed).catch(() => {});
        }
      }
      return null;
    });
  }, [awardGrowthFor, setActiveSession, setAttempts, setHistory, setPendingGrowthResult]);

  // Auto-dismisses the active session (and unblocks apps) the moment its
  // duration elapses, whether it was started manually or by a Timed Block
  // plan — the user should never have to remember to tap "End Block".
  // Also schedules a future notification so the user is notified even if
  // the app is killed or backgrounded before the timer fires.
  useEffect(() => {
    if (!activeSessionLoaded || !activeSession) return;

    const endsAt = activeSession.startedAt + activeSession.durationMinutes * 60_000;
    const remainingMs = endsAt - Date.now();

    // Re-runs whenever activeSession changes identity, including in-place
    // edits (e.g. duration changed via updateSession) — cancel whatever
    // end notification was scheduled for the previous state first, or the
    // stale one still fires alongside the new one.
    cancelBlockEndNotification(endNotificationIdRef.current);
    endNotificationIdRef.current = null;

    // Schedule a future notification as a background-safe fallback.
    scheduleBlockEndNotification(endsAt, activeSession.expectedGrowthCm, activeSession.label)
      .then((id) => { endNotificationIdRef.current = id; });

    const autoEnd = () => {
      // Cancel the scheduled notification — we're firing the immediate one instead.
      cancelBlockEndNotification(endNotificationIdRef.current);
      endNotificationIdRef.current = null;
      notifyBlockEnded(
        activeSession.label,
        roundGrowthCm(awardGrowthFor(activeSession, Date.now()).awardedGrowthCm)
      );
      stopSession();
    };

    if (remainingMs <= 0) {
      autoEnd();
      return;
    }
    const timer = setTimeout(autoEnd, remainingMs);
    return () => clearTimeout(timer);
  }, [activeSession, activeSessionLoaded, awardGrowthFor, stopSession]);

  // Live Activity on Lock Screen / Dynamic Island for whichever block is
  // running. Scheduled blocks the TimedBlockMonitor extension started while the
  // app was killed pick one up here too, once the adoption path in
  // TimedBlockPlansContext fills in activeSession.
  //
  // Gated on `activeSessionLoaded`: before storage resolves, `activeSession` is
  // null, and acting on that would tear down the Live Activity of a block that
  // is in fact still running.
  useEffect(() => {
    if (!activeSessionLoaded) return;

    if (!activeSession) {
      void ScreenTime.endBlockLiveActivity();
      return;
    }

    void ScreenTime.startBlockLiveActivity({
      startedAt: activeSession.startedAt,
      durationMinutes: activeSession.durationMinutes,
      label: activeSession.label ?? "Focus Block",
      focusMode: activeSession.focusMode,
    });
  }, [activeSession, activeSessionLoaded]);

  // What the growth model needs to price a block the user is still setting up.
  // Both move during the day, so a preview built from them is only an estimate.
  const growthPreview = useMemo(
    () => ({
      streakDays: getStreakDays(history),
      rawGrowthTodayCm: getRawGrowthToday(history),
    }),
    [history]
  );

  const value = useMemo(
    () => ({
      activeSession,
      isSessionLoaded: activeSessionLoaded,
      history,
      attempts,
      pendingGrowthResult,
      growthPreview,
      startSession,
      stopSession,
      updateSession,
      clearPendingGrowthResult,
      isOnBreak: !!activeSession && isOnBreak(breakState, Date.now()),
      breakAvailability,
      startBreak,
      endBreak,
    }),
    [
      activeSession,
      activeSessionLoaded,
      history,
      attempts,
      pendingGrowthResult,
      growthPreview,
      startSession,
      stopSession,
      updateSession,
      clearPendingGrowthResult,
      breakState,
      breakAvailability,
      startBreak,
      endBreak,
    ]
  );

  return (
    <FocusSessionContext.Provider value={value}>
      {children}
    </FocusSessionContext.Provider>
  );
}

export function useFocusSession() {
  const ctx = useContext(FocusSessionContext);
  if (!ctx) {
    throw new Error("useFocusSession must be used within a FocusSessionProvider");
  }
  return ctx;
}
