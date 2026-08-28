import React, { useMemo, useState } from "react";
import { useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { isObjectRevealed } from "@/constants/growthStages";
import { CULL_BUCKET_PX, getVisibleStages } from "@/lib/growthWorld";
import WorldObject from "@/components/growth/WorldObject";

interface ComparisonWorldProps {
  cameraX: SharedValue<number>;
  /** Camera position at mount, used to pick the first batch of objects to mount. */
  initialCameraX: number;
  /**
   * Real marshmallow size. Artwork is shown for every object this size or
   * smaller, plus the next two ahead; everything beyond that stays a placeholder.
   */
  actualSizeCm: number;
}

/**
 * The populated world. Objects far outside the viewport are left unmounted:
 * the camera position is bucketed to a coarse grid on the UI thread and only a
 * bucket *change* crosses to JS, so a full drag across the scene costs a
 * handful of re-renders instead of one per frame. The window is much wider
 * than the screen, so objects mount and unmount well out of sight.
 */
export default function ComparisonWorld({
  cameraX,
  initialCameraX,
  actualSizeCm,
}: ComparisonWorldProps) {
  const [cullBucket, setCullBucket] = useState(() =>
    Math.round(initialCameraX / CULL_BUCKET_PX),
  );

  useAnimatedReaction(
    () => Math.round(cameraX.value / CULL_BUCKET_PX),
    (bucket, previous) => {
      if (previous !== null && bucket !== previous) {
        scheduleOnRN(setCullBucket, bucket);
      }
    },
  );

  const visibleStages = useMemo(
    () => getVisibleStages(cullBucket * CULL_BUCKET_PX),
    [cullBucket],
  );

  return (
    <>
      {visibleStages.map((stage) => (
        <WorldObject
          key={stage.id}
          stage={stage}
          depthIndex={stage.index}
          cameraX={cameraX}
          revealed={isObjectRevealed(actualSizeCm, stage.sizeCm)}
        />
      ))}
    </>
  );
}
