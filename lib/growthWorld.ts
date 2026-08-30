import { OBJECT_STAGES, type GrowthStage } from "@/constants/growthStages";
import { getObjectAspectRatio } from "@/constants/objectImages";

/**
 * Geometry for the growth scene.
 *
 * The scene is a horizontal "scale world" viewed through a camera. Every
 * inhabitant (comparison objects and the marshmallow alike) owns a world
 * position derived from its real-world height, and the camera decides what
 * part of that world lands on screen:
 *
 *     worldX  = sizeToWorldX(heightCm)
 *     screenX = worldX - cameraX
 *
 * Placement starts from a logarithmic map so a doubling of size is the same
 * travel everywhere, then opens any consecutive pair that would otherwise
 * overlap. Nothing here knows about React, so all of it is safe to call from
 * a worklet on the UI thread or from JS during render.
 */

// ── World mapping ────────────────────────────────────────────────────────────

/**
 * Pixels of world per tenfold increase in size — the *natural* spacing,
 * before any pair is opened to keep sprites apart. Raising it spreads
 * objects; lowering it packs more of the range onto one screen.
 *
 * 1600 is set by blueberry (2cm) and grape (3cm), the widest ratio in the
 * set: their midpoint keeps both on a compact phone. Later pairs are closer
 * in ratio and would stack on this scale, so they are opened in
 * {@link buildStageWorldXs} rather than by stretching the whole decade.
 */
export const WORLD_PX_PER_DECADE = 1600;

/**
 * On-screen height of something exactly the size the camera is centred on.
 * Sprite footprints (and therefore the minimum gap between objects) are
 * derived from this.
 */
export const FOCUS_HEIGHT_PX = 162;

// ── Visual scale ─────────────────────────────────────────────────────────────

/**
 * How much of a real size ratio survives into on-screen size. 1.0 is
 * literal — a 6cm tangerine is drawn 20% taller than a 5cm egg when both
 * are on screen. Values below 1 used to compress that (0.72 turned 20%
 * into 14%), which made neighbouring objects look the same height.
 *
 * Far-off extremes are handled by the clamps below, not by gamma, so a
 * person does not fill the scene when the camera is still on a grape.
 */
export const VISUAL_GAMMA = 1;

/**
 * Floor for anything that leaves the screen anyway, so a far-off object is
 * never drawn as a speck. The pinned marshmallow passes {@link MIN_PINNED_SCALE}
 * instead, because there being tiny is the whole comparison.
 */
const VISUAL_SCALE_MIN = 0.24;
const VISUAL_SCALE_MAX = 1.62;

/**
 * On-screen scale of something of `objectCm` when the camera is looking at
 * `cameraCm`. Derived from the real size ratio rather than from pixel offset,
 * so objects still read as the right size after a pair has been opened.
 *
 * For comparison objects the clamps only engage well off screen, so on-screen
 * comparisons are never distorted by them. The pinned marshmallow stays on
 * screen far past that point, which is why it passes its own floor.
 */
export function visualScaleForSize(
  objectCm: number,
  cameraCm: number,
  minScale: number = VISUAL_SCALE_MIN,
): number {
  "worklet";
  const ratio = Math.max(objectCm, 0.01) / Math.max(cameraCm, 0.01);
  const raw = Math.pow(ratio, VISUAL_GAMMA);
  return Math.min(Math.max(raw, minScale), VISUAL_SCALE_MAX);
}

/** Extra pixels between neighbouring sprite edges, so they don't kiss. */
const SPRITE_EDGE_GAP_PX = 32;

function logSpacingPx(fromCm: number, toCm: number): number {
  return Math.log10(toCm / fromCm) * WORLD_PX_PER_DECADE;
}

function spriteFootprintPx(stageId: string): number {
  return FOCUS_HEIGHT_PX * getObjectAspectRatio(stageId);
}

function scaledHalfWidthPx(stage: GrowthStage, cameraCm: number): number {
  return (spriteFootprintPx(stage.id) * visualScaleForSize(stage.sizeCm, cameraCm)) / 2;
}

/**
 * World distance between two neighbouring stages: whatever the log map
 * asks for, but never less than the two sprites at the size they actually
 * draw. The squeeze is worst when the camera sits on the smaller object —
 * that one is at full size and the larger neighbour is scaled up — so the
 * gap is measured there (and checked at the larger object too).
 */
function gapBetweenStages(previous: GrowthStage, next: GrowthStage): number {
  const natural = logSpacingPx(previous.sizeCm, next.sizeCm);
  const atPrevious =
    scaledHalfWidthPx(previous, previous.sizeCm) +
    scaledHalfWidthPx(next, previous.sizeCm) +
    SPRITE_EDGE_GAP_PX;
  const atNext =
    scaledHalfWidthPx(previous, next.sizeCm) +
    scaledHalfWidthPx(next, next.sizeCm) +
    SPRITE_EDGE_GAP_PX;
  return Math.max(natural, atPrevious, atNext);
}

const STAGE_COUNT = OBJECT_STAGES.length;
const STAGE_CMS: number[] = OBJECT_STAGES.map((stage) => stage.sizeCm);

function buildStageWorldXs(): number[] {
  const xs: number[] = [
    Math.log10(OBJECT_STAGES[0].sizeCm) * WORLD_PX_PER_DECADE,
  ];
  for (let i = 1; i < STAGE_COUNT; i++) {
    xs.push(xs[i - 1] + gapBetweenStages(OBJECT_STAGES[i - 1], OBJECT_STAGES[i]));
  }
  return xs;
}

const STAGE_XS: number[] = buildStageWorldXs();

/**
 * World position of an object of the given real height. Between stages this
 * interpolates in log-size, so equal ratios still cover equal travel inside
 * a pair; across a pair that had to be opened, that travel is simply longer.
 */
export function sizeToWorldX(heightCm: number): number {
  "worklet";
  const height = Math.max(heightCm, 0.01);

  if (height <= STAGE_CMS[0]) {
    const rate =
      (STAGE_XS[1] - STAGE_XS[0]) / Math.log10(STAGE_CMS[1] / STAGE_CMS[0]);
    return STAGE_XS[0] + Math.log10(height / STAGE_CMS[0]) * rate;
  }

  if (height >= STAGE_CMS[STAGE_COUNT - 1]) {
    const last = STAGE_COUNT - 1;
    const rate =
      (STAGE_XS[last] - STAGE_XS[last - 1]) /
      Math.log10(STAGE_CMS[last] / STAGE_CMS[last - 1]);
    return STAGE_XS[last] + Math.log10(height / STAGE_CMS[last]) * rate;
  }

  for (let i = 0; i < STAGE_COUNT - 1; i++) {
    if (height <= STAGE_CMS[i + 1]) {
      const t =
        Math.log(height / STAGE_CMS[i]) /
        Math.log(STAGE_CMS[i + 1] / STAGE_CMS[i]);
      return STAGE_XS[i] + t * (STAGE_XS[i + 1] - STAGE_XS[i]);
    }
  }

  return STAGE_XS[STAGE_COUNT - 1];
}

/** Inverse of {@link sizeToWorldX} — the real height the camera is looking at. */
export function worldXToSize(worldX: number): number {
  "worklet";
  if (worldX <= STAGE_XS[0]) {
    const rate =
      (STAGE_XS[1] - STAGE_XS[0]) / Math.log10(STAGE_CMS[1] / STAGE_CMS[0]);
    return STAGE_CMS[0] * Math.pow(10, (worldX - STAGE_XS[0]) / rate);
  }

  if (worldX >= STAGE_XS[STAGE_COUNT - 1]) {
    const last = STAGE_COUNT - 1;
    const rate =
      (STAGE_XS[last] - STAGE_XS[last - 1]) /
      Math.log10(STAGE_CMS[last] / STAGE_CMS[last - 1]);
    return STAGE_CMS[last] * Math.pow(10, (worldX - STAGE_XS[last]) / rate);
  }

  for (let i = 0; i < STAGE_COUNT - 1; i++) {
    if (worldX <= STAGE_XS[i + 1]) {
      const t = (worldX - STAGE_XS[i]) / (STAGE_XS[i + 1] - STAGE_XS[i]);
      return (
        STAGE_CMS[i] * Math.pow(STAGE_CMS[i + 1] / STAGE_CMS[i], t)
      );
    }
  }

  return STAGE_CMS[STAGE_COUNT - 1];
}

// ── Scene geometry ───────────────────────────────────────────────────────────

export const SCENE_HEIGHT = 272;

/** Distance from the bottom of the scene to the ground line everything stands on. */
export const GROUND_Y = 56;

/**
 * How far below the object ground line the marshmallow stands, which reads as
 * it being in front of the objects rather than among them. The pin undoes it:
 * a marshmallow being compared to an object belongs on that object's line.
 */
export const MARSHMALLOW_FOREGROUND_DROP_PX = 50;

/** Ground line the marshmallow stands on when it holds the focal point. */
export const MARSHMALLOW_GROUND_Y = GROUND_Y - MARSHMALLOW_FOREGROUND_DROP_PX;

/** Gap between an object's crown and the caption sitting above it. */
export const OBJECT_LABEL_GAP = 8;

/**
 * The character's own size-driven scale is pinned to a constant, so the only
 * thing that scales it in the scene is the world law above. Without this the
 * marshmallow would visibly balloon as its real size grew, which is exactly
 * the illusion the moving world is meant to replace.
 */
export const MARSHMALLOW_PINNED_SIZE_CM = 3;

// ── Pinning ──────────────────────────────────────────────────────────────────

/**
 * Camera travel over which the marshmallow eases from standing in the
 * foreground into the comparison pose, up on the object ground line.
 */
export const PIN_RAMP_PX = 116;

/**
 * Smallest the marshmallow is drawn while pinned, in pixels of height. Against
 * a 170cm object the true ratio is under two pixels, which is a comparison
 * nobody can see.
 */
const MIN_PINNED_HEIGHT_PX = 12;

export const MIN_PINNED_SCALE = MIN_PINNED_HEIGHT_PX / FOCUS_HEIGHT_PX;

/**
 * The marshmallow's screen offset, given the offset the world law alone asks
 * for.
 *
 * Scrubbing down to smaller objects is unchanged: the marshmallow drifts off
 * to the right and grows as it goes, like any other inhabitant. Scrubbing up
 * is where the comparison lives, so it holds the middle of the scene and
 * shrinks in place, standing against whatever the camera has moved on to.
 */
export function pinnedOffsetPx(offsetPx: number): number {
  "worklet";
  return Math.max(offsetPx, 0);
}

/**
 * 0 with the marshmallow in the foreground, 1 once it is fully in the
 * comparison pose. Eased over {@link PIN_RAMP_PX} rather than switched, so it
 * rises to the object ground line instead of jumping there the moment the
 * camera passes it.
 */
export function pinProgress(offsetPx: number): number {
  "worklet";
  if (offsetPx >= 0) return 0;
  return 1 - Math.exp(offsetPx / PIN_RAMP_PX);
}

// ── Depth / occlusion ────────────────────────────────────────────────────────

const OBJECT_FADE_START_PX = 150;
const OBJECT_FADE_END_PX = 330;

/** Objects read as full strength near the focus and dissolve into the distance. */
export function getDepthOpacity(offsetPx: number): number {
  "worklet";
  const distance = Math.abs(offsetPx);
  if (distance <= OBJECT_FADE_START_PX) return 1;
  if (distance >= OBJECT_FADE_END_PX) return 0;
  const t =
    (distance - OBJECT_FADE_START_PX) / (OBJECT_FADE_END_PX - OBJECT_FADE_START_PX);
  return 1 - t * t;
}

/**
 * Only the object nearest the camera captions itself, so exactly one name is
 * legible at a time. Each object owns the stretch of world running to the
 * midpoint of each of its neighbours — which matters most at the large end,
 * where objects genuinely are close in size and would otherwise stack their
 * captions on top of each other.
 */
export function getLabelOpacity(
  cameraX: number,
  claimFromX: number,
  claimToX: number,
  crossfadePx: number,
): number {
  "worklet";
  const entering = (cameraX - (claimFromX - crossfadePx)) / (2 * crossfadePx);
  const leaving = (claimToX + crossfadePx - cameraX) / (2 * crossfadePx);
  return Math.max(0, Math.min(1, Math.min(entering, leaving)));
}

/** Half-width of the handover between one object's caption and the next. */
const LABEL_CROSSFADE_PX = 26;

/** The first and last objects claim this far past the ends of the world. */
const EDGE_CLAIM_MARGIN_PX = 400;

/** Horizontal reach of the marshmallow's silhouette, past which nothing is hidden by it. */
const OVERLAP_RADIUS_PX = 145;

/** Fraction of an occluded object that must stay visible above the marshmallow. */
const OVERLAP_PEEK_FRACTION = 0.5;

/** Ceiling on the lift, so a much smaller object doesn't float absurdly high. */
const MAX_LIFT_FRACTION = 0.6;

/** 1 when an object sits directly behind the marshmallow, 0 once it is clear of it. */
export function getOverlapFactor(offsetFromOccluderPx: number): number {
  "worklet";
  const t = 1 - Math.min(Math.abs(offsetFromOccluderPx) / OVERLAP_RADIUS_PX, 1);
  return t * t * (3 - 2 * t);
}

/**
 * How far to raise an object off the ground so it stays readable behind the
 * marshmallow. An object of equal height gets lifted by half its own height,
 * which is exactly enough for its top half to clear the marshmallow's crown;
 * taller objects need no lift at all since they already tower over it.
 *
 * The lift is scaled by how much the two actually overlap, so an object clear
 * of the marshmallow just stands on the ground. Conveniently the lifted edge
 * is always the *bottom* edge, which is precisely the part the marshmallow is
 * covering — so nothing ever looks like it is hovering.
 */
export function getObjectLiftPx(
  objectHeightPx: number,
  occluderHeightPx: number,
  overlapFactor: number,
): number {
  "worklet";
  const needed = occluderHeightPx - OVERLAP_PEEK_FRACTION * objectHeightPx;
  const capped = Math.min(
    Math.max(needed, 0),
    occluderHeightPx * MAX_LIFT_FRACTION,
  );
  return capped * overlapFactor;
}

// ── Camera limits ────────────────────────────────────────────────────────────

const smallestStageCm = OBJECT_STAGES[0].sizeCm;
const largestStageCm = OBJECT_STAGES[OBJECT_STAGES.length - 1].sizeCm;

export const VIEW_MIN_CM = smallestStageCm * 0.9;
export const VIEW_MAX_CM = largestStageCm * 1.12;
export const CAMERA_MIN_X = sizeToWorldX(VIEW_MIN_CM);
export const CAMERA_MAX_X = sizeToWorldX(VIEW_MAX_CM);

/** Resistance applied past the ends of the world, so the drag never hits a wall. */
const RUBBER_BAND_FACTOR = 0.28;
const RUBBER_BAND_MAX_PX = 90;

/** Clamp with give: past the ends the camera keeps moving, but grudgingly. */
export function rubberBandToWorld(worldX: number): number {
  "worklet";
  if (worldX < CAMERA_MIN_X) {
    const overshoot = CAMERA_MIN_X - worldX;
    return CAMERA_MIN_X - Math.min(overshoot * RUBBER_BAND_FACTOR, RUBBER_BAND_MAX_PX);
  }
  if (worldX > CAMERA_MAX_X) {
    const overshoot = worldX - CAMERA_MAX_X;
    return CAMERA_MAX_X + Math.min(overshoot * RUBBER_BAND_FACTOR, RUBBER_BAND_MAX_PX);
  }
  return worldX;
}

// ── Stages, pre-positioned ───────────────────────────────────────────────────

export interface WorldStage extends GrowthStage {
  worldX: number;
  /** Rank by size, which doubles as draw order — bigger objects sit in front. */
  index: number;
  /** Stretch of world over which this object owns the floor caption. */
  claimFromX: number;
  claimToX: number;
  claimCrossfadePx: number;
}

/**
 * Every comparison object with its world position resolved once. Adding an
 * object anywhere in `GROWTH_STAGES` is enough for it to appear at the right
 * place, at the right size, with the right neighbours — there is no per-object
 * layout or animation code.
 */
export const WORLD_STAGES: WorldStage[] = OBJECT_STAGES.map((stage, index) => {
  const worldX = sizeToWorldX(stage.sizeCm);
  const previous = OBJECT_STAGES[index - 1];
  const next = OBJECT_STAGES[index + 1];

  const claimFromX = previous
    ? (worldX + sizeToWorldX(previous.sizeCm)) / 2
    : worldX - EDGE_CLAIM_MARGIN_PX;
  const claimToX = next
    ? (worldX + sizeToWorldX(next.sizeCm)) / 2
    : worldX + EDGE_CLAIM_MARGIN_PX;

  return {
    ...stage,
    worldX,
    index,
    claimFromX,
    claimToX,
    // Never crossfade over more than a third of the claim, so tightly packed
    // objects still get a stretch where their caption is fully legible.
    claimCrossfadePx: Math.min(
      LABEL_CROSSFADE_PX,
      (claimToX - claimFromX) / 3,
    ),
  };
});

/**
 * Only objects reasonably near the viewport are mounted. The window is
 * generous (well past the screen edges) so objects appear and disappear far
 * out of sight and the set only changes every so often while dragging.
 */
export const CULL_BUCKET_PX = 180;
const CULL_HALF_WIDTH_PX = 620;

export function getVisibleStages(cameraX: number): WorldStage[] {
  return WORLD_STAGES.filter(
    (stage) => Math.abs(stage.worldX - cameraX) <= CULL_HALF_WIDTH_PX,
  );
}

// ── Ruler ────────────────────────────────────────────────────────────────────

export interface RulerTick {
  cm: number;
  worldX: number;
  isMajor: boolean;
  label: string | null;
}

/**
 * A logarithmic ruler needs logarithmic ticks: within each decade the marks
 * sit at 1, 1.5, 2, 2.5 … 9 times that decade's base, which keeps their pixel
 * spacing even across the whole range rather than dense at one end.
 */
function buildRulerTicks(): RulerTick[] {
  const steps = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9];
  const minCm = VIEW_MIN_CM / 1.6;
  const maxCm = VIEW_MAX_CM * 1.6;
  const ticks: RulerTick[] = [];

  for (let decade = 0; decade <= 2; decade++) {
    const base = Math.pow(10, decade);
    for (const step of steps) {
      const cm = step * base;
      if (cm < minCm || cm > maxCm) continue;
      const isMajor = Number.isInteger(step);
      ticks.push({
        cm,
        worldX: sizeToWorldX(cm),
        isMajor,
        label: isMajor ? `${cm}` : null,
      });
    }
  }

  return ticks;
}

export const RULER_TICKS = buildRulerTicks();

export const RULER_HEIGHT = 62;

// ── Interaction tuning ───────────────────────────────────────────────────────

/**
 * World distance between haptic detents. Equal travel is an equal *size
 * ratio* inside a naturally spaced pair, and a smaller ratio inside a pair
 * that had to be opened — so the scrub stays notched even where objects
 * would otherwise sit on top of each other.
 */
export const DETENT_PX = 48;

/** How long the camera lingers on the previewed size before returning home. */
export const RETURN_DWELL_MS = 700;

/** Duration of the main sweep when growth lands. */
export const GROWTH_SWEEP_MS = 620;

/**
 * The growth sweep carries slightly past the new size and eases back, which
 * gives a small size gain enough world travel to read as a reward.
 */
export const GROWTH_OVERSHOOT_FRACTION = 0.35;
export const GROWTH_OVERSHOOT_MAX_PX = 40;
