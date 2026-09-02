import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Theme from "@/constants/theme";
import Button from "./Button";
import { CUSTOM_LIGHTNESS_RANGE, hexToHsl, hslToHex, type Hsl } from "@/lib/color";

/** Stripes drawn per track to fake a gradient — enough that the banding reads as smooth. */
const TRACK_STOPS = 48;
const THUMB_SIZE = 26;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface ChannelSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Colour of the track at `ratio` (0–1) along it. */
  stopColor: (ratio: number) => string;
  onChange: (value: number) => void;
}

/**
 * One draggable channel of the picker. Built on `PanResponder` rather than
 * gesture-handler because this lives inside an RN `Modal`, which sits outside
 * the `GestureHandlerRootView` the rest of the app is wrapped in.
 */
function ChannelSlider({ label, value, min, max, stopColor, onChange }: ChannelSliderProps) {
  const [width, setWidth] = useState(0);
  // Read inside the responder callbacks, which are created once and would
  // otherwise close over the values from the first render.
  const widthRef = useRef(0);
  const startValueRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const track = widthRef.current;
          if (track <= 0) return;
          // The stripes and thumb are `pointerEvents: none`, so `locationX` is
          // measured against the track itself.
          const ratio = clamp(e.nativeEvent.locationX / track, 0, 1);
          const next = min + ratio * (max - min);
          startValueRef.current = next;
          onChange(next);
        },
        onPanResponderMove: (_e, gesture) => {
          const track = widthRef.current;
          if (track <= 0) return;
          const delta = (gesture.dx / track) * (max - min);
          onChange(clamp(startValueRef.current + delta, min, max));
        },
      }),
    [max, min, onChange]
  );

  const ratio = (value - min) / (max - min);
  const thumbLeft = Math.max(0, width - THUMB_SIZE) * ratio;

  return (
    <View style={styles.slider}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.track} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={styles.trackStops} pointerEvents="none">
          {Array.from({ length: TRACK_STOPS }, (_, i) => (
            <View
              key={i}
              style={[styles.trackStop, { backgroundColor: stopColor(i / (TRACK_STOPS - 1)) }]}
            />
          ))}
        </View>
        {width > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              { left: thumbLeft, backgroundColor: stopColor(ratio) },
            ]}
          />
        )}
      </View>
    </View>
  );
}

interface CustomColorModalProps {
  visible: boolean;
  /** Colour the sliders open on — the marshmallow's current colour. */
  initialColor: string;
  onCancel: () => void;
  onConfirm: (hex: string) => void;
}

/** Premium-only HSL picker for a marshmallow colour outside the fixed palette. */
export default function CustomColorModal({
  visible,
  initialColor,
  onCancel,
  onConfirm,
}: CustomColorModalProps) {
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(initialColor));

  // Reopening should start from whatever the marshmallow is wearing now, not
  // from where the sliders were left the last time.
  useEffect(() => {
    if (visible) setHsl(hexToHsl(initialColor));
  }, [visible, initialColor]);

  const hex = hslToHex(hsl);

  const setChannel = useCallback(
    (key: keyof Hsl) => (next: number) => setHsl((prev) => ({ ...prev, [key]: next })),
    []
  );

  const setHue = useMemo(() => setChannel("h"), [setChannel]);
  const setSaturation = useMemo(() => setChannel("s"), [setChannel]);
  const setLightness = useMemo(() => setChannel("l"), [setChannel]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Custom Color</Text>

          <View style={styles.previewRow}>
            <View style={[styles.preview, { backgroundColor: hex }]} />
            <Text style={styles.previewHex}>{hex}</Text>
          </View>

          <ChannelSlider
            label="Hue"
            value={hsl.h}
            min={0}
            max={360}
            stopColor={(r) => hslToHex({ h: r * 360, s: Math.max(hsl.s, 45), l: 70 })}
            onChange={setHue}
          />
          <ChannelSlider
            label="Saturation"
            value={hsl.s}
            min={0}
            max={100}
            stopColor={(r) => hslToHex({ h: hsl.h, s: r * 100, l: hsl.l })}
            onChange={setSaturation}
          />
          <ChannelSlider
            label="Brightness"
            value={hsl.l}
            min={CUSTOM_LIGHTNESS_RANGE.min}
            max={CUSTOM_LIGHTNESS_RANGE.max}
            stopColor={(r) =>
              hslToHex({
                h: hsl.h,
                s: hsl.s,
                l:
                  CUSTOM_LIGHTNESS_RANGE.min +
                  r * (CUSTOM_LIGHTNESS_RANGE.max - CUSTOM_LIGHTNESS_RANGE.min),
              })
            }
            onChange={setLightness}
          />

          <Button label="Use This Color" onPress={() => onConfirm(hex)} style={styles.confirm} />
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radius.xxl,
    padding: Theme.spacing.xxl,
    ...Theme.shadows.card,
  },
  title: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    textAlign: "center",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  preview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.06)",
    ...Theme.shadows.card,
  },
  previewHex: {
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
    letterSpacing: 1,
  },
  slider: {
    marginBottom: Theme.spacing.lg,
  },
  sliderLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
    marginBottom: Theme.spacing.sm,
  },
  track: {
    height: THUMB_SIZE,
    justifyContent: "center",
  },
  trackStops: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  trackStop: {
    flex: 1,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: Theme.colors.white,
    ...Theme.shadows.card,
  },
  confirm: {
    marginTop: Theme.spacing.sm,
  },
  cancel: {
    marginTop: Theme.spacing.lg,
    textAlign: "center",
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
  },
});
