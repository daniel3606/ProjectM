import { getItemById, resolveEquippedEmoji, type EquippedItems } from "@/constants/items";
import Theme from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";



const BLINK_EASING = Easing.inOut(Easing.quad);
const CLOSE_MS = 100;
const HOLD_MS = 150;
const OPEN_MS = 100;
const MOUTH_LIFT = -3;

/** Layout height of the body, and therefore of the whole character. */
export const MARSHMALLOW_BODY_HEIGHT = 222;

/** Body width and corner radius, exported so a silhouette can match the shape. */
export const MARSHMALLOW_BODY_WIDTH = 200;
export const MARSHMALLOW_BODY_RADIUS = 70;

/**
 * Minor size-driven scale applied inside the character. Exported so callers
 * that place the character in a scaled scene can work out its drawn height.
 */
export function getMarshmallowIntrinsicScale(sizeCm: number) {
  return 0.9 + Math.min(sizeCm / 60, 0.4);
}


function randomBlinkDelay() {
  return 3000 + Math.random() * 3000;
}

interface MarshmallowCharacterProps {
  color: string;
  name: string;
  sizeCm: number;
  isBlocking?: boolean;
  items?: EquippedItems;
}

export default function MarshmallowCharacter({
  color,
  name,
  sizeCm,
  isBlocking,
  items,
}: MarshmallowCharacterProps) {
  const {
    headwear: headwearEmoji,
    wings: wingsEmoji,
    face: faceEmoji,
  } = resolveEquippedEmoji(items);
  const headwearItem = getItemById(items?.headwear);
  const scale = getMarshmallowIntrinsicScale(sizeCm);

  const blinkScaleY = useSharedValue(1);
  const mouthTranslateY = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const triggerBlink = () => {
      blinkScaleY.value = withSequence(
        withTiming(0.1, { duration: CLOSE_MS, easing: BLINK_EASING }),
        withDelay(HOLD_MS, withTiming(1, { duration: OPEN_MS, easing: BLINK_EASING })),
      );
      mouthTranslateY.value = withSequence(
        withTiming(MOUTH_LIFT, { duration: CLOSE_MS, easing: BLINK_EASING }),
        withDelay(HOLD_MS, withTiming(0, { duration: OPEN_MS, easing: BLINK_EASING })),
      );
      timerRef.current = setTimeout(triggerBlink, randomBlinkDelay());
    };

    timerRef.current = setTimeout(triggerBlink, randomBlinkDelay());

    return () => {
      clearTimeout(timerRef.current);
      cancelAnimation(blinkScaleY);
      cancelAnimation(mouthTranslateY);
    };
  }, [blinkScaleY, mouthTranslateY]);

  const eyeBlinkStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blinkScaleY.value }],
  }));

  const mouthBlinkStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mouthTranslateY.value }],
  }));

  return (
    <View style={[styles.container]}>
      <View style={[styles.wrapper, { transform: [{ scale }] }]}>
        {/* Ground shadow */}
        <View style={styles.groundShadow} />

        {wingsEmoji && (
          <>
            <Text style={[styles.wingEmoji, styles.wingLeft]}>{wingsEmoji}</Text>
            <Text style={[styles.wingEmoji, styles.wingRight]}>{wingsEmoji}</Text>
          </>
        )}

        {/* Body */}
        <View style={[styles.body, { backgroundColor: color }]}>
          {/* Shine highlight */}
          <View style={styles.shine} />

          {headwearItem?.image ? (
            <Image
              source={headwearItem.image}
              style={styles.headwearImage}
              resizeMode="contain"
            />
          ) : headwearEmoji ? (
            <Text style={styles.headwearEmoji}>{headwearEmoji}</Text>
          ) : null}

          <View style={styles.face}>
            <View style={styles.faceShift}>
              <View style={styles.eyes}>
                <Animated.View style={[styles.eye, eyeBlinkStyle]}>
                  <View style={styles.eyeHighlight} />
                </Animated.View>
                <Animated.View style={[styles.eye, eyeBlinkStyle]}>
                  <View style={styles.eyeHighlight} />
                </Animated.View>
              </View>

              {isBlocking ? (
                <Animated.View style={[styles.mouthSmileWrap, mouthBlinkStyle]}>
                  <View style={styles.mouthSmileLine} />
                </Animated.View>
              ) : (
                <Animated.View style={[styles.mouthDeterminedLines, mouthBlinkStyle]}>
                  <View style={styles.mouthLineStraight} />
                </Animated.View>
              )}

              {faceEmoji && <Text style={styles.faceEmoji}>{faceEmoji}</Text>}
            </View>
          </View>

        </View>
      </View>

      {/* Name */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  groundShadow: {
    position: "absolute",
    bottom: -8,
    width: 161,
    height: 38,
    borderRadius: 265,
    marginLeft: 30,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  body: {
    width: MARSHMALLOW_BODY_WIDTH,
    height: MARSHMALLOW_BODY_HEIGHT,
    borderRadius: MARSHMALLOW_BODY_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  shine: {
    position: "absolute",
    top: 14,
    left: 28,
    width: 40,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.5)",
    transform: [{ rotate: "-20deg" }],
  },
  face: {
    alignItems: "center",
    marginTop: 8,
  },
  faceShift: {
    alignItems: "center",
    marginRight: 28,
    marginTop: 30,
  },
  eyes: {
    flexDirection: "row",
    gap: 54,
    marginBottom: 12,
  },
  eye: {
    width: 26,
    height: 26,
    borderRadius: 100,
    backgroundColor: "#2C2C2E",
  },
  eyeHighlight: {
    position: "absolute",
    top: 5,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
  },
  cheeks: {
    flexDirection: "row",
    gap: 50,
    marginBottom: 6,
  },
  cheek: {
    width: 20,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,130,130,0.3)",
  },
  mouthSmileWrap: {
    alignItems: "center",
  },
  mouthSmileLine: {
    width: 25,
    height: 10,
    borderTopWidth: 0,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 17,
    borderColor: "#2C2C2E",
    backgroundColor: "transparent",
    marginRight: 7,
    marginTop: 5,
  },
  mouthDeterminedLines: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  mouthLineStraight: {
    width: 26,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#2C2C2E",
  },
  headwearEmoji: {
    position: "absolute",
    top: -34,
    fontSize: 44,
  },
  headwearImage: {
    position: "absolute",
    top: -40,
    left: (MARSHMALLOW_BODY_WIDTH - 110) / 2,
    width: 110,
    height: 50,
  },
  wingEmoji: {
    position: "absolute",
    top: 70,
    fontSize: 56,
    opacity: 0.95,
  },
  wingLeft: {
    left: -38,
    transform: [{ scaleX: -1 }],
  },
  wingRight: {
    right: -38,
  },
  faceEmoji: {
    position: "absolute",
    top: -6,
    right: -18,
    fontSize: 22,
  },
  shieldBadge: {
    position: "absolute",
    top: -6,
    right: -6,
  },
  shieldEmoji: {
    fontSize: 24,
  },
  name: {
    marginTop: 14,
    fontSize: 20,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
});
