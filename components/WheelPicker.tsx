import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import Theme from "@/constants/theme";

export const ITEM_HEIGHT = 40;
export const VISIBLE_COUNT = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
const PADDING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

/** How far from the centre a row still contributes to the drum curve. */
const CURVE_ROWS = (VISIBLE_COUNT - 1) / 2;
/** Degrees of X-rotation applied per row of distance from the centre. */
const DEGREES_PER_ROW = 26;
/** Perspective depth; lower exaggerates the curve. */
const PERSPECTIVE = 560;

interface WheelPickerProps {
  data: number[];
  selectedValue: number;
  onChange: (value: number) => void;
  formatLabel: (value: number) => string;
  width?: number;
  /** Haptic tick as each row passes the centre. Matches the native iOS picker. */
  haptics?: boolean;
}

// ── Row ──────────────────────────────────────────────────────────────────────
// Every transform is derived from `scrollY` inside a worklet, so the wheel
// curves and fades entirely on the UI thread — the rows never re-render while
// the user is dragging.

interface WheelRowProps {
  index: number;
  label: string;
  scrollY: SharedValue<number>;
  onPress: (index: number) => void;
}

const WheelRow = React.memo(function WheelRow({
  index,
  label,
  scrollY,
  onPress,
}: WheelRowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // > 0 when this row sits above the centre, < 0 when below.
    const offset = scrollY.value / ITEM_HEIGHT - index;
    const clamped = Math.max(-CURVE_ROWS - 1, Math.min(CURVE_ROWS + 1, offset));
    const distance = Math.abs(clamped);

    return {
      opacity: interpolate(distance, [0, 1, 2, 3], [1, 0.5, 0.22, 0], Extrapolation.CLAMP),
      transform: [
        { perspective: PERSPECTIVE },
        { rotateX: `${clamped * DEGREES_PER_ROW}deg` },
        { scale: interpolate(distance, [0, 1, 2], [1, 0.88, 0.78], Extrapolation.CLAMP) },
      ],
    };
  });

  const handlePress = useCallback(() => onPress(index), [onPress, index]);

  return (
    <Pressable onPress={handlePress} testID={`wheel-row-${index}`}>
      <Animated.View style={[styles.item, animatedStyle]}>
        <Text style={styles.itemText} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

// ── Picker ───────────────────────────────────────────────────────────────────

export default function WheelPicker({
  data,
  selectedValue,
  onChange,
  formatLabel,
  width = 92,
  haptics = true,
}: WheelPickerProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const selectedIndex = Math.max(0, data.indexOf(selectedValue));
  // The index the wheel itself last settled on. Kept in a ref so the effect
  // below can tell an externally-driven `selectedValue` change (scroll to it)
  // apart from the echo of a change this wheel just reported (ignore it).
  const settledIndexRef = useRef(selectedIndex);

  const scrollY = useSharedValue(selectedIndex * ITEM_HEIGHT);
  const initialOffset = useMemo(
    () => ({ x: 0, y: selectedIndex * ITEM_HEIGHT }),
    // Mount-time only: later changes are driven by the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // `onChange`/`data` change identity between renders; reading them through a
  // ref keeps the worklet reaction below from being torn down every render.
  // Synced in an effect rather than during render so the React Compiler
  // doesn't have to bail out on a render-phase ref write.
  const reportRef = useRef({ data, onChange, haptics });
  useEffect(() => {
    reportRef.current = { data, onChange, haptics };
  });

  const reportIndex = useCallback((index: number) => {
    // Already where we were told to be — this is the scroll event from the
    // sync effect below, not the user moving the wheel. No tick, no emit.
    if (index === settledIndexRef.current) return;

    const { data: rows, onChange: emit, haptics: withHaptics } = reportRef.current;
    const value = rows[index];
    if (value === undefined) return;
    settledIndexRef.current = index;
    if (withHaptics) Haptics.selectionAsync();
    emit(value);
  }, []);

  const centredIndex = useDerivedValue(() => {
    const raw = Math.round(scrollY.value / ITEM_HEIGHT);
    return Math.min(Math.max(raw, 0), data.length - 1);
  }, [data.length]);

  // Emits while the wheel is still moving rather than only once it stops, so
  // the dependent UI (duration, expected growth) tracks the drag live.
  useAnimatedReaction(
    () => centredIndex.value,
    (current, previous) => {
      if (previous === null || current === previous) return;
      scheduleOnRN(reportIndex, current);
    }
  );

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      runOnUI(() => {
        scrollTo(scrollRef, 0, index * ITEM_HEIGHT, animated);
      })();
    },
    [scrollRef]
  );

  // Follows `selectedValue` when it is changed from outside (e.g. the sheet
  // loading an existing plan). Skipped when the value is just this wheel's own
  // last emission coming back down as a prop.
  useEffect(() => {
    const index = data.indexOf(selectedValue);
    if (index < 0 || index === settledIndexRef.current) return;
    settledIndexRef.current = index;
    // Jump, don't animate: this fires as the sheet opens on an existing plan,
    // and four wheels sliding into place at once reads as a glitch.
    scrollToIndex(index, false);
  }, [selectedValue, data, scrollToIndex]);

  return (
    <View style={[styles.container, { width, height: PICKER_HEIGHT }]}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        contentOffset={initialOffset}
        contentContainerStyle={styles.content}
      >
        {data.map((item, index) => (
          <WheelRow
            key={item}
            index={index}
            label={formatLabel(item)}
            scrollY={scrollY}
            onPress={scrollToIndex}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  content: {
    paddingVertical: PADDING,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontSize: 21,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
});
