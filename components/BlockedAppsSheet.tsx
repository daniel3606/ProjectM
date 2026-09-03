import { ProBadge } from "@/components/ui/SettingRow";
import Theme from "@/constants/theme";
import type {
  BlockMode,
  ScreenTimeItem,
  TokenItemInput,
} from "@/modules/screen-time";
import * as ScreenTime from "@/modules/screen-time";
import { getSelectionListView } from "@/modules/screen-time";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Re-exported so callers of this sheet don't have to reach into the native
// module for the type of the value it hands back.
export type { BlockMode };

// Every dimension the rows use is fixed here. ScreenTimeTokenLabel draws into
// the box it is handed and reports no size of its own, so a row's layout is
// settled before iOS has resolved any app — the icon and name cannot shift off
// the row's centre line depending on when they arrive.
const ROW_HEIGHT = 64;
const ROW_ICON = 40;
const ROW_GAP = Theme.spacing.lg;
const ROW_NAME_FONT_SIZE = 17;

interface BlockedAppsSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  /** Committed selection, used to seed the draft each time the sheet opens. */
  selected: ScreenTimeItem[];
  mode: BlockMode;
  isPremium: boolean;
  /** Sends the user to the paywall when they reach for a PRO-only control. */
  onUpgrade: () => void;
  /** Fired on confirm only; backing out discards the draft. */
  onConfirm: (selected: ScreenTimeItem[], mode: BlockMode) => void;
}

/**
 * Full-height sheet for choosing what a block covers. Opened from the
 * Blocked Apps row on the Quick Block sheet; edits are held as a draft and
 * only handed back when the user confirms with the check button.
 */
export default function BlockedAppsSheet({
  sheetRef,
  selected,
  mode,
  isPremium,
  onUpgrade,
  onConfirm,
}: BlockedAppsSheetProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["94%"], []);

  // Both lists are drawn natively — a Screen Time token only renders through
  // SwiftUI's own label. Absent on a build without the module.
  const SelectionList = getSelectionListView();

  const [draft, setDraft] = useState<ScreenTimeItem[]>(selected);
  const [draftMode, setDraftMode] = useState<BlockMode>(mode);

  const drawableDraft = useMemo(
    () => draft.filter((item) => Boolean(item.token)),
    [draft]
  );

  const selectionItems = useMemo<TokenItemInput[]>(
    () =>
      drawableDraft.map((item) => ({
        id: item.id,
        type: item.type,
        token: item.token as string,
      })),
    [drawableDraft]
  );

  const selectionListHeight = selectionItems.length * ROW_HEIGHT;
  // Clip to the row stack so extra native height cannot open a gap
  // after the last row. A parent View is required — overflow on the
  // native view itself is ignored until a native rebuild.
  const selectionListStyle = useMemo(
    () => ({ height: selectionListHeight, overflow: "hidden" as const }),
    [selectionListHeight]
  );

  // Re-seed from the committed values whenever the parent's selection
  // changes, so a discarded draft never leaks into the next open.
  useEffect(() => {
    setDraft(selected);
    setDraftMode(mode);
  }, [selected, mode]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="none"
      />
    ),
    []
  );

  const handleDismiss = useCallback(() => {
    setDraft(selected);
    setDraftMode(mode);
    sheetRef.current?.dismiss();
  }, [selected, mode, sheetRef]);

  const handleConfirm = useCallback(() => {
    onConfirm(draft, draftMode);
    sheetRef.current?.dismiss();
  }, [draft, draftMode, onConfirm, sheetRef]);

  const handleSelectMode = useCallback(
    (next: BlockMode) => {
      if (next === "allowOnly" && !isPremium) {
        onUpgrade();
        return;
      }
      setDraftMode(next);
    },
    [isPremium, onUpgrade]
  );

  // The system picker owns the whole selection, so whatever comes back
  // replaces the draft rather than merging into it.
  const handleAddFromPicker = useCallback(async () => {
    try {
      const picked = await ScreenTime.openAppPicker();
      if (picked !== null) setDraft(picked);
    } catch {
      Alert.alert("Error", "Failed to open the app picker.");
    }
  }, []);

  const handleRemove = useCallback((id: string) => {
    setDraft((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleRemoveEvent = useCallback(
    (event: { nativeEvent: { id: string } }) => {
      handleRemove(event.nativeEvent.id);
    },
    [handleRemove]
  );

  const emptyStateText =
    draftMode === "block"
      ? "No Apps will be blocked"
      : "Everything will be blocked";

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      stackBehavior="push"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={handleDismiss}
          hitSlop={12}
          style={styles.headerButton}
          testID="blocked-apps-back"
        >
          <Ionicons name="chevron-back" size={22} color={Theme.colors.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Selected</Text>

        <Pressable
          onPress={handleConfirm}
          hitSlop={12}
          style={[styles.headerButton, styles.confirmButton]}
          testID="blocked-apps-confirm"
        >
          <Ionicons name="checkmark" size={22} color={Theme.colors.white} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Block / Allow Only ───────────────────────────────────── */}
        <View style={styles.segmented}>
          <Pressable
            onPress={() => handleSelectMode("block")}
            style={[styles.segment, draftMode === "block" && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                draftMode === "block" && styles.segmentTextActive,
              ]}
            >
              Block
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSelectMode("allowOnly")}
            style={[styles.segment, draftMode === "allowOnly" && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                draftMode === "allowOnly" && styles.segmentTextActive,
              ]}
            >
              Allow Only
            </Text>
            {!isPremium && <ProBadge />}
          </Pressable>
        </View>

        <Text style={styles.modeHint}>
          {draftMode === "block"
            ? "These apps and websites are blocked while the block runs."
            : "Only these apps and websites stay open. Everything else is blocked."}
        </Text>

        {/* ── Add ──────────────────────────────────────────────────── */}
        <Pressable
          onPress={handleAddFromPicker}
          style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
        >
          <View style={styles.addTile}>
            <Ionicons name="add" size={24} color={Theme.colors.text} />
          </View>
          <Text style={styles.rowName}>Add App or Website</Text>
        </Pressable>

        {/* ── Current selection ────────────────────────────────────── */}
        {selectionItems.length === 0 ? (
          <>
            <View style={styles.rowDivider} />
            <Text style={styles.emptyText}>{emptyStateText}</Text>
          </>
        ) : (
          <>
            {SelectionList ? (
              <>
                <View style={styles.selectionListGap} />
                <View style={selectionListStyle}>
                  <SelectionList
                    items={selectionItems}
                    rowHeight={ROW_HEIGHT}
                    iconSize={ROW_ICON}
                    fontSize={ROW_NAME_FONT_SIZE}
                    dividerInset={ROW_ICON + ROW_GAP}
                    textColor={Theme.colors.text}
                    dividerColor={Theme.colors.cardBorder}
                    removeBackground={Theme.colors.lightGray}
                    removeTint={Theme.colors.textSecondary}
                    onRemove={handleRemoveEvent}
                    style={selectionListStyle}
                  />
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>
                Update the app to see your selected apps.
              </Text>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: Theme.radius.xxl,
    borderTopRightRadius: Theme.radius.xxl,
    ...Theme.shadows.sheet,
  },
  handleIndicator: {
    width: 40,
    backgroundColor: Theme.colors.gray,
    opacity: 0.35,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.xxl,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xl,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  confirmButton: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xxl,
  },

  /* Block / Allow Only */
  segmented: {
    flexDirection: "row",
    backgroundColor: Theme.colors.lightGray,
    borderRadius: Theme.radius.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.xs,
    paddingVertical: 10,
    borderRadius: Theme.radius.pill,
  },
  segmentActive: {
    backgroundColor: Theme.colors.white,
    ...Theme.shadows.card,
  },
  segmentText: {
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  segmentTextActive: {
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  modeHint: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: Theme.spacing.md,
  },

  /* Rows */
  // Matches the native list's row metrics so the add row lines up with them.
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_GAP,
    height: ROW_HEIGHT,
  },
  addTile: {
    width: ROW_ICON,
    height: ROW_ICON,
    borderRadius: Theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  rowName: {
    fontSize: ROW_NAME_FONT_SIZE,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.cardBorder,
    // Inset to the name, so the dividers break at the text not under the icons.
    marginLeft: ROW_ICON + ROW_GAP,
  },
  selectionListGap: {
    height: Theme.spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    paddingVertical: Theme.spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
});
