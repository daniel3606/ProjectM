import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import { Card, Button, SectionLabel } from "@/components/ui";
import { estimateGrowthCm, formatDuration } from "@/constants/marshmallow";
import * as ScreenTime from "@/modules/screen-time";
import type { ScreenTimeItem } from "@/modules/screen-time";
import { useFocusSession, type ActiveSession } from "@/contexts/FocusSessionContext";

const DURATION_STEP = 5;
const MAX_DURATION = 240;

export interface EditBlockPatch {
  durationMinutes: number;
  /** Re-estimated for the new duration; the award is still recomputed at completion. */
  expectedGrowthCm: number;
  appIds: string[];
  appsSummary: { appCount: number; catCount: number; webCount: number };
}

interface EditBlockSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  session: ActiveSession | null;
  onSave: (patch: EditBlockPatch) => void;
  /** Dismisses this sheet and hands off to the screen's own end-session confirmation. */
  onCancelBlock: () => void;
}

/** Lets the user adjust the duration and blocked apps of an already-running block, or end it entirely. */
export default function EditBlockSheet({ sheetRef, session, onSave, onCancelBlock }: EditBlockSheetProps) {
  const insets = useSafeAreaInsets();
  const { growthPreview } = useFocusSession();

  const [totalMinutes, setTotalMinutes] = useState(session?.durationMinutes ?? DURATION_STEP);
  const [selectedApps, setSelectedApps] = useState<ScreenTimeItem[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  const snapPoints = useMemo(() => ["70%"], []);

  // Duration can't be edited below what's already elapsed — otherwise Save
  // would instantly end the block instead of shortening it.
  const elapsedMinutes = session
    ? Math.floor((Date.now() - session.startedAt) / 60_000)
    : 0;
  const minDuration = Math.max(DURATION_STEP, elapsedMinutes + DURATION_STEP);

  const estimateGrowth = useCallback(
    (minutes: number) =>
      session
        ? estimateGrowthCm({
            minutes,
            blockType: session.blockType ?? "quick",
            isHardBlock: !!session.isHardMode,
            streakDays: growthPreview.streakDays,
            rawGrowthTodayCm: growthPreview.rawGrowthTodayCm,
          })
        : 0,
    [session, growthPreview]
  );

  const expectedGrowth = estimateGrowth(totalMinutes);

  const appCount = selectedApps.filter((i) => i.type === "application").length;
  const catCount = selectedApps.filter((i) => i.type === "category").length;
  const webCount = selectedApps.filter((i) => i.type === "webDomain").length;
  const totalSelected = selectedApps.length;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const handleSheetChange = useCallback(
    async (index: number) => {
      if (index !== 0 || !session) return;
      setTotalMinutes(Math.max(session.durationMinutes, minDuration));
      setIsLoadingApps(true);
      try {
        const items = await ScreenTime.getSelectedItems();
        setSelectedApps(items);
      } catch {
        // Silently fail; user can still pick apps manually
      } finally {
        setIsLoadingApps(false);
      }
    },
    [session, minDuration]
  );

  const handlePickApps = useCallback(async () => {
    try {
      const picked = await ScreenTime.openAppPicker();
      if (picked !== null) {
        setSelectedApps(picked);
      }
    } catch {
      Alert.alert("Error", "Failed to open app picker.");
    }
  }, []);

  const handleDecreaseDuration = useCallback(() => {
    setTotalMinutes((prev) => Math.max(minDuration, prev - DURATION_STEP));
  }, [minDuration]);

  const handleIncreaseDuration = useCallback(() => {
    setTotalMinutes((prev) => Math.min(MAX_DURATION, prev + DURATION_STEP));
  }, []);

  const handleSave = useCallback(async () => {
    if (!session) return;
    const appIds = selectedApps.map((i) => i.id);
    try {
      // Preserve the running block's policy — re-applying as a plain block
      // would quietly downgrade an "Allow Only" session on every edit.
      await ScreenTime.applyBlockMode(session.blockMode ?? "block", appIds);
    } catch {
      Alert.alert("Error", "Failed to update blocked apps.");
      return;
    }

    sheetRef.current?.dismiss();
    onSave({
      durationMinutes: totalMinutes,
      expectedGrowthCm: estimateGrowth(totalMinutes),
      appIds,
      appsSummary: { appCount, catCount, webCount },
    });
  }, [session, selectedApps, totalMinutes, estimateGrowth, appCount, catCount, webCount, sheetRef, onSave]);

  const handleCancelBlock = useCallback(() => {
    sheetRef.current?.dismiss();
    onCancelBlock();
  }, [sheetRef, onCancelBlock]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      onChange={handleSheetChange}
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit Block</Text>
          <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={12}>
            <Ionicons name="close-circle" size={28} color={Theme.colors.gray} />
          </Pressable>
        </View>

        <SectionLabel style={styles.sectionTitle}>Block Duration</SectionLabel>
        <View style={styles.durationCard}>
          <Pressable
            onPress={handleDecreaseDuration}
            disabled={totalMinutes <= minDuration}
            style={({ pressed }) => [
              styles.durationStepButton,
              pressed && styles.pressed,
              totalMinutes <= minDuration && styles.durationStepButtonDisabled,
            ]}
          >
            <Ionicons name="remove" size={22} color={Theme.colors.secondary} />
          </Pressable>

          <Text style={styles.durationValueText}>{formatDuration(totalMinutes)}</Text>

          <Pressable
            onPress={handleIncreaseDuration}
            disabled={totalMinutes >= MAX_DURATION}
            style={({ pressed }) => [
              styles.durationStepButton,
              pressed && styles.pressed,
              totalMinutes >= MAX_DURATION && styles.durationStepButtonDisabled,
            ]}
          >
            <Ionicons name="add" size={22} color={Theme.colors.secondary} />
          </Pressable>
        </View>
        <Text style={styles.growthHint}>+{expectedGrowth}cm expected growth</Text>

        <SectionLabel style={styles.sectionTitle}>Applications to Block</SectionLabel>
        <Card tone="surface" style={styles.card}>
          {isLoadingApps ? (
            <ActivityIndicator color={Theme.colors.secondary} style={styles.appLoader} />
          ) : totalSelected > 0 ? (
            <View style={styles.appSummary}>
              {appCount > 0 && (
                <Text style={styles.appSummaryText}>
                  {appCount} app{appCount !== 1 ? "s" : ""} selected
                </Text>
              )}
              {catCount > 0 && (
                <Text style={styles.appSummaryText}>
                  {catCount} categor{catCount !== 1 ? "ies" : "y"} selected
                </Text>
              )}
              {webCount > 0 && (
                <Text style={styles.appSummaryText}>
                  {webCount} web domain{webCount !== 1 ? "s" : ""} selected
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.noAppsText}>Blocking everything</Text>
          )}

          <Button
            variant="outline"
            onPress={handlePickApps}
            icon="add-circle-outline"
            iconSize={18}
            label="Add Apps"
          />
        </Card>

        <Button
          onPress={handleSave}
          disabled={!session}
          icon="checkmark-circle-outline"
          iconSize={22}
          label="Save Changes"
          style={styles.saveButton}
        />

        <Button
          variant="ghost"
          onPress={handleCancelBlock}
          disabled={!session}
          icon="stop-circle-outline"
          iconSize={18}
          label="Cancel Block"
          style={styles.cancelButton}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handleIndicator: {
    width: 40,
    backgroundColor: Theme.colors.gray,
    opacity: 0.35,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  sectionTitle: {
    marginBottom: 10,
    marginTop: 20,
  },
  card: {
    padding: 16,
    alignItems: "center",
  },
  durationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  durationStepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  durationStepButtonDisabled: {
    opacity: 0.4,
  },
  durationValueText: {
    fontSize: 22,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  growthHint: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  appLoader: {
    paddingVertical: 8,
  },
  appSummary: {
    width: "100%",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  appSummaryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  noAppsText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    marginBottom: 12,
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 28,
  },
  cancelButton: {
    marginTop: 4,
    alignSelf: "center",
  },
});
