import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import SettingRow, { ProBadge } from "@/components/ui/SettingRow";
import * as ScreenTime from "@/modules/screen-time";
import { ScreenTimeTokenLabel } from "@/modules/screen-time";
import type { BlockMode, ScreenTimeItem } from "@/modules/screen-time";

// Re-exported so callers of this sheet don't have to reach into the native
// module for the type of the value it hands back.
export type { BlockMode };

// Only reached for items with no token behind them — anything the picker
// returns is drawn by ScreenTimeTokenLabel with its real icon instead.
const ITEM_ICON: Record<ScreenTimeItem["type"], React.ComponentProps<typeof Ionicons>["name"]> = {
  application: "apps-outline",
  category: "folder-outline",
  webDomain: "globe-outline",
};

// Both leave room for the padding, gap and close icon around them, so a long
// app name truncates inside the chip/tile instead of pushing past it.
const CHIP_LABEL_MAX_WIDTH = 130;
const SUGGESTED_LABEL_MAX_WIDTH = 64;

interface BlockedAppsSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  /** Committed selection, used to seed the draft each time the sheet opens. */
  selected: ScreenTimeItem[];
  mode: BlockMode;
  /** Apps chosen during onboarding, offered as one-tap adds. */
  suggested: ScreenTimeItem[];
  isPremium: boolean;
  /** Sends the user to the paywall when they reach for a PRO-only control. */
  onUpgrade: () => void;
  /** Fired on confirm only; backing out discards the draft. */
  onConfirm: (selected: ScreenTimeItem[], mode: BlockMode) => void;
  neverAllowed: ScreenTimeItem[];
  onChangeNeverAllowed: (items: ScreenTimeItem[]) => void;
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
  suggested,
  isPremium,
  onUpgrade,
  onConfirm,
  neverAllowed,
  onChangeNeverAllowed,
}: BlockedAppsSheetProps) {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["94%"], []);

  const [draft, setDraft] = useState<ScreenTimeItem[]>(selected);
  const [draftMode, setDraftMode] = useState<BlockMode>(mode);

  // Suggestions saved before tokens were stored can't be drawn as the app they
  // stand for, and their ids are positions into a selection that has since been
  // replaced — tapping one would add whatever now sits at that index. Leave
  // them out; the row fills back in once onboarding apps are picked again.
  const resolvableSuggested = useMemo(
    () => suggested.filter((app) => Boolean(app.token)),
    [suggested]
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

  const handleEditNeverAllowed = useCallback(async () => {
    if (!isPremium) {
      onUpgrade();
      return;
    }
    try {
      const picked = await ScreenTime.openAppPicker();
      if (picked !== null) onChangeNeverAllowed(picked);
    } catch {
      Alert.alert("Error", "Failed to open the app picker.");
    }
  }, [isPremium, onUpgrade, onChangeNeverAllowed]);

  const handleToggleSuggested = useCallback((app: ScreenTimeItem) => {
    setDraft((prev) =>
      prev.some((item) => item.id === app.id)
        ? prev.filter((item) => item.id !== app.id)
        : [...prev, app]
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setDraft((prev) => prev.filter((item) => item.id !== id));
  }, []);

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
        <Pressable onPress={handleAddFromPicker} style={styles.addRow}>
          <View style={styles.addIcon}>
            <Ionicons name="add" size={22} color={Theme.colors.text} />
          </View>
          <Text style={styles.addLabel}>Add App or Website</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* ── Current selection ────────────────────────────────────── */}
        {draft.length === 0 ? (
          <Text style={styles.emptyText}>{emptyStateText}</Text>
        ) : (
          <View style={styles.chipWrap}>
            {draft.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleRemove(item.id)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <ScreenTimeTokenLabel
                  item={item}
                  mode="both"
                  fontSize={13}
                  color={Theme.colors.text}
                  maxWidth={CHIP_LABEL_MAX_WIDTH}
                  fallback={
                    <>
                      <Ionicons
                        name={ITEM_ICON[item.type]}
                        size={15}
                        color={Theme.colors.secondary}
                      />
                      <Text style={styles.chipText} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </>
                  }
                />
                <Ionicons name="close" size={14} color={Theme.colors.gray} />
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Suggested ────────────────────────────────────────────── */}
        {resolvableSuggested.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Suggested</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedRow}
            >
              {resolvableSuggested.map((app) => {
                const isAdded = draft.some((item) => item.id === app.id);
                return (
                  <Pressable
                    key={app.id}
                    onPress={() => handleToggleSuggested(app)}
                    style={({ pressed }) => [
                      styles.suggestedTile,
                      isAdded && styles.suggestedTileAdded,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ScreenTimeTokenLabel
                      item={app}
                      mode="icon"
                      fontSize={26}
                      maxWidth={SUGGESTED_LABEL_MAX_WIDTH}
                      fallback={
                        <Ionicons
                          name={ITEM_ICON[app.type]}
                          size={22}
                          color={isAdded ? Theme.colors.white : Theme.colors.secondary}
                        />
                      }
                    />
                    <ScreenTimeTokenLabel
                      item={app}
                      mode="name"
                      fontSize={11}
                      color={isAdded ? Theme.colors.white : Theme.colors.textSecondary}
                      maxWidth={SUGGESTED_LABEL_MAX_WIDTH}
                      fallback={
                        <Text
                          style={[
                            styles.suggestedLabel,
                            isAdded && styles.suggestedLabelAdded,
                          ]}
                          numberOfLines={1}
                        >
                          {app.label}
                        </Text>
                      }
                    />
                    <View style={styles.suggestedBadge}>
                      <Ionicons
                        name={isAdded ? "checkmark" : "add"}
                        size={12}
                        color={Theme.colors.white}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <View style={styles.divider} />

        {/* ── Never Allowed ────────────────────────────────────────── */}
        <SettingRow
          title="Never Allowed"
          subtitle={
            neverAllowed.length > 0
              ? `${neverAllowed.length} always blocked`
              : "Nothing set up"
          }
          pro={!isPremium}
          chevron
          onPress={handleEditNeverAllowed}
          testID="never-allowed-row"
        />
        <Text style={styles.footnote}>
          Apps and websites here stay blocked in every block you run — they are
          added to a Block list and left out of an Allow Only one.
        </Text>
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

  /* Add row */
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.lg,
    paddingVertical: Theme.spacing.lg,
    marginTop: Theme.spacing.sm,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  addLabel: {
    fontSize: 17,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.cardBorder,
    marginVertical: Theme.spacing.lg,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    paddingVertical: Theme.spacing.sm,
  },

  /* Selection chips */
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Theme.spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    maxWidth: 180,
  },
  chipText: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    flexShrink: 1,
  },

  /* Suggested */
  sectionHeading: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: Theme.spacing.xxl,
    marginBottom: Theme.spacing.md,
  },
  suggestedRow: {
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxs,
  },
  suggestedTile: {
    width: 78,
    height: 78,
    borderRadius: Theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.xxs,
    paddingHorizontal: Theme.spacing.xs,
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  suggestedTileAdded: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  suggestedLabel: {
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  suggestedLabelAdded: {
    color: Theme.colors.white,
  },
  suggestedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.secondaryLight,
  },
  footnote: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    lineHeight: 17,
    textAlign: "center",
    marginTop: Theme.spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
