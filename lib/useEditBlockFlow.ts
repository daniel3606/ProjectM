import { useCallback, useRef, useState } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useTimedBlockPlans } from "@/contexts/TimedBlockPlansContext";
import type { EditBlockPatch } from "@/components/EditBlockSheet";

/**
 * Drives the "Edit Block" flow shared by Home and the Timed Block tab: a
 * name-gated confirmation, the edit sheet itself, and saving the result.
 *
 * A Timed Block session's duration/apps are copied from its plan at start
 * time (see `TimedBlockPlansContext`), which also re-derives them from the
 * plan on every schedule re-check — so an edit has to update the plan itself
 * (not just the live session) or the next check would revert it.
 */
export function useEditBlockFlow() {
  const { activeSession, updateSession } = useFocusSession();
  const { plans, updatePlan } = useTimedBlockPlans();
  const editBlockSheetRef = useRef<BottomSheetModal>(null);
  const [isEditGateVisible, setIsEditGateVisible] = useState(false);

  const openEditGate = useCallback(() => setIsEditGateVisible(true), []);
  const cancelEditGate = useCallback(() => setIsEditGateVisible(false), []);

  const confirmEditGate = useCallback(() => {
    setIsEditGateVisible(false);
    editBlockSheetRef.current?.present();
  }, []);

  const saveEditedBlock = useCallback(
    (patch: EditBlockPatch) => {
      updateSession({
        durationMinutes: patch.durationMinutes,
        expectedGrowthCm: patch.expectedGrowthCm,
      });

      if (activeSession?.planId) {
        const plan = plans.find((p) => p.id === activeSession.planId);
        if (plan) {
          const { id, ...rest } = plan;
          updatePlan(id, {
            ...rest,
            durationMinutes: patch.durationMinutes,
            appIds: patch.appIds,
            appsSummary: patch.appsSummary,
          });
        }
      }
    },
    [activeSession, plans, updatePlan, updateSession]
  );

  return {
    editBlockSheetRef,
    isEditGateVisible,
    openEditGate,
    cancelEditGate,
    confirmEditGate,
    saveEditedBlock,
  };
}
