import { OBJECT_STAGES, type GrowthStage } from "@/constants/growthStages";

/**
 * Geometry for the growth scene.
 *
 * The scene is a horizontal "scale world" viewed through a camera. Every
 * inhabitant (comparison objects and the marshmallow alike) owns a world
 * position derived only from its real-world height, and the camera decides
 * what part of that world lands on screen:
 *
 *     worldX  = sizeToWorldX(heightCm)
 *     screenX = worldX - cameraX
 *
 * Nothing here knows about React, so all of it is safe to call from a
 * worklet on the UI thread or from JS during render.
 */

// ── World mapping ────────────────────────────────────────────────────────────

/**
 * Pixels of world per tenfold increase in size. This is *the* tuning knob:
 * raising it spreads objects apart (fewer on screen, more travel per cm of
 * growth), lowering it packs more of the size range into one screenful.
 *
 * The mapping is logarithmic rather than linear because the range spans two
 * decades (2cm to 170cm) — at any linear scale that made early growth
 * legible, a person would sit kilometres off screen. Log also means a fixed
 * drag distance always changes size by a fixed *ratio*, so scrubbing feels
 * identical whether the marshmallow is a grape or a chair.
 */
export const WORLD_PX_PER_DECADE = 2500;

/** World position of an object of the given real height. */
export function sizeToWorldX(heightCm: number): number {
  "worklet";
  return Math.log10(Math.max(heightCm, 0.01)) * WORLD_PX_PER_DECADE;
}

/** Inverse of {@link sizeToWorldX} — the real height the camera is looking at. */
export function worldXToSize(worldX: number): number {
  "worklet";
  return Math.pow(10, worldX / WORLD_PX_PER_DECADE);
}

// ── Visual scale ─────────────────────────────────────────────────────────────

/**
 * How much of a real size ratio survives into on-screen size. 1.0 would be
 * literal (a 10cm object drawn twice as tall as a 5cm one); values below 1
 * compress the extremes so nothing becomes absurd near the edges of the
 * viewport while a doubling still reads as clearly, obviously bigger.
 */
export const VISUAL_GAMMA = 0.72;

const VISUAL_SCALE_MIN = 0.24;
const VISUAL_SCALE_MAX = 1.62;

/**
 * Visual scale of anything sitting `offsetPx` from the centre of the screen,
 * where 1 means "the same on-screen height as whatever the camera is centred
 * on". Because the world is logarithmic, horizontal offset *is* the size
 * ratio, so this single expression scales comparison objects and the
 * marshmallow identically and keeps them in one coordinate system.
 *
 * The clamps only engage well off screen, so on-screen comparisons are never
 * distorted by them.
 */
export function screenOffsetToScale(offsetPx: number): number {
  "worklet";
  const raw = Math.pow(10, (VISUAL_GAMMA * offsetPx) / WORLD_PX_PER_DECADE);
  return Math.min(Math.max(raw, VISUAL_SCALE_MIN), VISUAL_SCALE_MAX);
}

// ── Scene geometry ───────────────────────────────────────────────────────────

export const SCENE_HEIGHT = 272;

/** Distance from the bottom of the scene to the ground line everything stands on. */
export const GROUND_Y = 56;

/**
 * Marshmallow stands a little lower than the comparison objects so its feet
 * read as in front of them on the same ground plane.
 */
export const MARSHMALLOW_GROUND_Y = GROUND_Y - 50;

/**
 * On-screen height of something exactly the size the camera is centred on.
 * `SCENE_HEIGHT - GROUND_Y` has to accommodate this times VISUAL_SCALE_MAX,
 * otherwise the largest objects clip against the top of the scene.
 */
export const FOCUS_HEIGHT_PX = 162;

/** Gap between an object's crown and the caption sitting above it. */
export const OBJECT_LABEL_GAP = 8;

/**
 * The character's own size-driven scale is pinned to a constant, so the only
 * thing that scales it in the scene is the world law above. Without this the
 * marshmallow would visibly balloon as its real size grew, which is exactly
 * the illusion the moving world is meant to replace.
 */
export const MARSHMALLOW_PINNED_SIZE_CM = 3;

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
 * spacing between roughly 30 and 130px everywhere from 2cm to 190cm.
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
 * World distance between haptic detents. Because the world is logarithmic
 * these land at even *ratio* steps (~8% of size each), so the scrub feels
 * evenly notched across the whole range rather than dense at one end.
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
