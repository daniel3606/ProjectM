import React, { useCallback, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Theme from "@/constants/theme";

export const ITEM_HEIGHT = 36;
export const VISIBLE_COUNT = 5;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
const PADDING = (ITEM_HEIGHT * (VISIBLE_COUNT - 1)) / 2;
const FADE_STEPS = [0.85, 0.55, 0.25, 0];

interface WheelPickerProps {
  data: number[];
  selectedValue: number;
  onChange: (value: number) => void;
  formatLabel: (value: number) => string;
  width?: number;
  fadeColor?: string;
}

export default function WheelPicker({
  data,
  selectedValue,
  onChange,
  formatLabel,
  width = 84,
  fadeColor = Theme.colors.white,
}: WheelPickerProps) {
  const listRef = useRef<FlatList<number>>(null);

  const snapToValue = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const clamped = Math.min(Math.max(index, 0), data.length - 1);
      const value = data[clamped];
      if (value !== selectedValue) {
        onChange(value);
      }
      listRef.current?.scrollToOffset({
        offset: clamped * ITEM_HEIGHT,
        animated: true,
      });
    },
    [data, selectedValue, onChange]
  );

  return (
    <View style={[styles.container, { width, height: PICKER_HEIGHT }]}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => String(item)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PADDING }}
        initialScrollIndex={Math.max(0, data.indexOf(selectedValue))}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onMomentumScrollEnd={snapToValue}
        onScrollEndDrag={snapToValue}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text
              style={[
                styles.itemText,
                item === selectedValue && styles.itemTextSelected,
              ]}
            >
              {formatLabel(item)}
            </Text>
          </View>
        )}
      />

      {/* Fade the rows nearest the top/bottom edges, like a native wheel picker */}
      <View pointerEvents="none" style={styles.topFade}>
        {FADE_STEPS.map((opacity, i) => (
          <View
            key={i}
            style={[styles.fadeBand, { backgroundColor: fadeColor, opacity }]}
          />
        ))}
      </View>
      <View pointerEvents="none" style={styles.bottomFade}>
        {[...FADE_STEPS].reverse().map((opacity, i) => (
          <View
            key={i}
            style={[styles.fadeBand, { backgroundColor: fadeColor, opacity }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontSize: 20,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
  itemTextSelected: {
    fontSize: 20,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: PADDING,
    flexDirection: "column",
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: PADDING,
    flexDirection: "column",
  },
  fadeBand: {
    flex: 1,
  },
});
