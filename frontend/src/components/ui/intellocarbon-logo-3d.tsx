"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  BAND_MITER_LIMIT,
  BAND_PATH,
  BAND_STROKE_WIDTH,
  MONOGRAM_C_PATH,
  MONOGRAM_TRANSFORM,
} from "./intellocarbon-logo";

/**
 * The Intellocarbon mark with the full dimensional treatment: extrusion stack,
 * gradient face, gloss overlay, specular highlights, hover parallax and a slow
 * idle float.
 *
 * The depth is drawn, not computed. The stack is 30 offset copies of the same
 * geometry painted far-to-near, so the only real 3D is a CSS rotation on the
 * <svg> — a parallax wobble over a composite that is already lit and extruded
 * in its own artwork. The two do not need to agree geometrically, and the
 * rotation is deliberately small enough that they never visibly disagree.
 *
 * That is also what makes this affordable in a header: the 30 layers are built
 * once and never touched again, and a pointermove writes exactly one style
 * property on one element. See the performance note on the pointer handler.
 */

/** Per the brand spec. */
const LAYERS = 30;
const STEP = 1.15;

/** Side-face ramps, near → far. Interpolated by t = i / (LAYERS - 1). */
const BAND_SIDE_NEAR = "#1C8F86";
const BAND_SIDE_FAR = "#062A32";
const LETTER_SIDE_NEAR = "#93A6AA";
const LETTER_SIDE_FAR = "#2E3C42";

/** Rest attitude, per the spec. Parallax swings around these. */
const REST_PITCH = -6;
const REST_YAW = -16;
const MAX_YAW = 20;
const MAX_PITCH = 15;

const TRANSITION = "transform 220ms cubic-bezier(.2,.7,.3,1)";

/**
 * Idle float: a slow drift around the rest attitude when nothing is pointing
 * at the mark.
 *
 * Amplitude is deliberately a fraction of the hover swing (±20°/±15°) — enough
 * that the mark reads as a solid object catching the light rather than a flat
 * sticker, without becoming something the eye tracks while reading the page it
 * sits above. The two periods are incommensurate on purpose: equal or harmonic
 * periods trace a closed figure and the loop point becomes visible within a
 * few cycles.
 */
const FLOAT_YAW = 2.6;
const FLOAT_PITCH = 1.5;
const FLOAT_YAW_PERIOD = 7.3;
const FLOAT_PITCH_PERIOD = 5.1;
const TAU = Math.PI * 2;

/** Slightly past TRANSITION, so the ease back to rest finishes before the drift resumes. */
const FLOAT_RESUME_DELAY = 260;

/**
 * The stack trails down and to the right, away from the top-left key light
 * that the gloss ramp and both speculars already imply. This is a fixed
 * property of the artwork rather than a projection of REST_YAW/REST_PITCH —
 * the rotation is applied to the finished composite, so there is no camera to
 * be consistent with.
 */
const EXTRUDE_UNIT_X = 0.935;
const EXTRUDE_UNIT_Y = 0.354;

/**
 * Bounding box of the painted face in viewBox units, stroke included: the band
 * spans 14.97–105.03 with a 13-unit stroke either side, and the pointy-top
 * miters overshoot the 8/112 vertices by ~7.5 units.
 */
const FACE_MIN_X = 8.47;
const FACE_MAX_X = 111.53;
const FACE_MIN_Y = 0.5;
const FACE_MAX_Y = 119.5;

/** sRGB lerp between two #rrggbb values. Good enough for a 30-step ramp. */
function lerpHex(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const mix = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

interface StackGeometry {
  /** Far-to-near, so document order matches z-order. */
  layers: { i: number; dx: number; dy: number; band: string; letter: string }[];
  /** Scales and re-centres the assembly so the far layers are not clipped. */
  fitTransform: string;
  /** Fraction of the svg box the face occupies, after the fit scale. */
  boxRatio: number;
}

/**
 * Built per depth scale and cached: at a fixed scale these nodes are constant
 * for the life of the page, so no render ever recomputes them.
 */
const GEOMETRY_CACHE = new Map<number, StackGeometry>();

function stackGeometry(depthScale: number): StackGeometry {
  const cached = GEOMETRY_CACHE.get(depthScale);
  if (cached) return cached;

  const dx = EXTRUDE_UNIT_X * STEP * depthScale;
  const dy = EXTRUDE_UNIT_Y * STEP * depthScale;
  const spanX = FACE_MAX_X - FACE_MIN_X + Math.abs(dx) * (LAYERS - 1);
  const spanY = FACE_MAX_Y - FACE_MIN_Y + Math.abs(dy) * (LAYERS - 1);
  const scale = Math.min(120 / spanX, 120 / spanY);
  const fitX = -(FACE_MIN_X + Math.min(0, dx * (LAYERS - 1))) * scale + (120 - spanX * scale) / 2;
  const fitY = -(FACE_MIN_Y + Math.min(0, dy * (LAYERS - 1))) * scale + (120 - spanY * scale) / 2;

  const geometry: StackGeometry = {
    layers: Array.from({ length: LAYERS }, (_, n) => LAYERS - 1 - n).map((i) => {
      const t = i / (LAYERS - 1);
      return {
        i,
        dx: dx * i,
        dy: dy * i,
        band: lerpHex(BAND_SIDE_NEAR, BAND_SIDE_FAR, t),
        letter: lerpHex(LETTER_SIDE_NEAR, LETTER_SIDE_FAR, t),
      };
    }),
    fitTransform: `translate(${fitX.toFixed(3)},${fitY.toFixed(3)}) scale(${scale.toFixed(5)})`,
    boxRatio: scale,
  };

  GEOMETRY_CACHE.set(depthScale, geometry);
  return geometry;
}

/**
 * Depth the header runs at, as a fraction of the spec's full extrusion.
 *
 * The spec's 30 layers at STEP 1.15 is 33 units of travel on a 120-unit box —
 * 28% of the mark. That is right for the hero, where the mark is a few hundred
 * pixels across. At a 54px nav-bar mark the same depth swallows the artwork:
 * rendered and compared side by side at 1.0 / 0.6 / 0.45 / 0.3 / 0.2, the
 * hexagon silhouette dissolves into a slab above ~0.45 and the monogram's own
 * extrusion smears across the counter until the C reads as a filled blob. 0.3
 * is the most depth that still leaves the silhouette crisp and the IC legible.
 *
 * LAYERS, STEP and both ramps are unchanged, so a hero mounting this at
 * depthScale 1 gets the spec exactly.
 */
export const HEADER_DEPTH_SCALE = 0.3;

/** Fraction of the svg box the face occupies at a given depth. */
export const markBoxRatio = (depthScale: number) => stackGeometry(depthScale).boxRatio;

interface Logo3DProps {
  /** Size of the svg box in px. The face reads at size * markBoxRatio(depth). */
  size?: number;
  className?: string;
  decorative?: boolean;
  /** Namespaces this instance's gradient and mask ids. See IntellocarbonLogoFace. */
  idScope: string;
  /** 1 is the spec's full hero extrusion. See HEADER_DEPTH_SCALE. */
  depthScale?: number;
}

export function IntellocarbonLogo3D({
  size = 60,
  className,
  decorative = false,
  idScope,
  depthScale = 1,
}: Logo3DProps) {
  const gradId = `${idScope}Grad`;
  const glossId = `${idScope}Gloss`;
  const monoGradId = `${idScope}MonoGrad`;
  const maskId = `${idScope}BandMask`;

  const geometry = useMemo(() => stackGeometry(depthScale), [depthScale]);

  // The tilt lives entirely in this ref and the element's inline style. Nothing
  // about the pointer is held in state: a pointermove that set state would
  // re-render all 30 extrusion layers every frame. The spec calls this out
  // explicitly and it is why this is affordable on a header that mounts on
  // every page — the only per-frame work is one style write on one element.
  const markRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  /** Assigned by the effect below; the pointer handlers drive the float through it. */
  const float = useRef<{ start: () => void; stop: () => void } | null>(null);
  const hovering = useRef(false);

  const applyTilt = useCallback((pitch: number, yaw: number) => {
    const el = markRef.current;
    if (!el) return;
    el.style.transform = `rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
  }, []);

  useEffect(() => {
    const el = markRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let origin = 0;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    let onscreen = true;

    const tick = (now: number) => {
      if (!origin) origin = now;
      const t = (now - origin) / 1000;
      el.style.transform =
        `rotateX(${(REST_PITCH + Math.sin((t / FLOAT_PITCH_PERIOD) * TAU) * FLOAT_PITCH).toFixed(2)}deg) ` +
        `rotateY(${(REST_YAW + Math.sin((t / FLOAT_YAW_PERIOD) * TAU) * FLOAT_YAW).toFixed(2)}deg)`;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      clearTimeout(resumeTimer);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      origin = 0;
    };

    const start = () => {
      clearTimeout(resumeTimer);
      // Never autonomous under reduced motion, never while the pointer owns the
      // tilt, and never while the header is scrolled off screen — a nav bar
      // logo spends most of a long page out of view, and an rAF loop animating
      // something nobody can see is pure cost. rAF already stops itself in a
      // background tab, so that case needs nothing here.
      if (frame || motion.matches || hovering.current || !onscreen) return;
      // The drift writes every frame, so a transition would sit on top of it
      // smoothing each write into the next and lagging the whole loop. Hover
      // re-enables it for the ease in and out.
      el.style.transition = "none";
      frame = requestAnimationFrame(tick);
    };

    const restore = () => {
      // Both leaving the mark and gaining focus land here: ease home under the
      // transition, then hand back to the drift once it has settled.
      el.style.transition = motion.matches ? "none" : TRANSITION;
      el.style.transform = `rotateX(${REST_PITCH}deg) rotateY(${REST_YAW}deg)`;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(start, FLOAT_RESUME_DELAY);
    };

    float.current = {
      start: restore,
      stop: () => {
        stop();
        // Parallax still tracks the pointer under reduced motion — it is
        // pointer-driven, not autonomous — but it snaps rather than easing, so
        // there is no motion the user did not directly cause.
        el.style.transition = motion.matches ? "none" : TRANSITION;
      },
    };

    const onMotionChange = () => {
      if (motion.matches) {
        stop();
        restore();
      } else {
        start();
      }
    };
    motion.addEventListener("change", onMotionChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        onscreen = entry.isIntersecting;
        if (onscreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    observer.observe(wrap);

    // Set before the first start(): under reduced motion start() bails out
    // immediately, and the element would otherwise keep the easing transition
    // it was rendered with.
    el.style.transition = motion.matches ? "none" : TRANSITION;
    start();

    return () => {
      stop();
      observer.disconnect();
      motion.removeEventListener("change", onMotionChange);
      float.current = null;
    };
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      if (!hovering.current) {
        hovering.current = true;
        float.current?.stop();
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      const nx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1);
      const ny = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1);
      applyTilt(REST_PITCH - ny * MAX_PITCH, REST_YAW + nx * MAX_YAW);
    },
    [applyTilt],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    // Keeps the tilt tracking a held pointer that leaves the mark, so it cannot
    // be stranded mid-swing. Not a drag interaction — that is hero-only.
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    hovering.current = false;
    float.current?.start();
  }, []);

  return (
    <span
      ref={wrapRef}
      className={cn("inline-block shrink-0 leading-none", className)}
      // Only perspective is set here. The box used to be pinned to `size` as
      // well, which meant a caller resizing the svg through CSS — as the header
      // does responsively — left the span at the original size with the smaller
      // svg anchored in its top-left corner: the mark rode high against the
      // wordmark and carried dead space in front of it. The span is
      // inline-block, so with no dimensions of its own it shrink-wraps the svg
      // and tracks whatever size the svg actually renders at.
      style={{ perspective: `${size * 7}px` }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      {...(decorative ? { "aria-hidden": true } : { role: "img" as const, "aria-label": "Intellocarbon" })}
    >
      <svg
        ref={markRef}
        viewBox="0 0 120 120"
        width={size}
        height={size}
        style={{
          display: "block",
          transform: `rotateX(${REST_PITCH}deg) rotateY(${REST_YAW}deg)`,
          transition: TRANSITION,
          willChange: "transform",
        }}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="16" y1="10" x2="104" y2="110">
            <stop offset="0%" stopColor="#4BE895" />
            <stop offset="46%" stopColor="#15B9A4" />
            <stop offset="100%" stopColor="#2A78A6" />
          </linearGradient>

          {/* Gloss runs steeply across the upper-left of the face, per spec. */}
          <linearGradient id={glossId} gradientUnits="userSpaceOnUse" x1="30" y1="8" x2="66" y2="104">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={monoGradId} gradientUnits="userSpaceOnUse" x1="34" y1="36" x2="86" y2="84">
            <stop offset="0%" stopColor="#FDFEFE" />
            <stop offset="55%" stopColor="#DCE6E6" />
            <stop offset="100%" stopColor="#B4C2C4" />
          </linearGradient>

          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
            <path
              d={BAND_PATH}
              fill="none"
              stroke="#fff"
              strokeWidth={BAND_STROKE_WIDTH}
              strokeLinejoin="miter"
              strokeMiterlimit={BAND_MITER_LIMIT}
              strokeLinecap="butt"
            />
          </mask>
        </defs>

        <g transform={geometry.fitTransform}>
          {/* Side faces, far to near. Solid fills, so these can stroke directly
              — the mask-and-fill dance is only needed for gradient paint. */}
          {geometry.layers.map((layer) => (
            <g key={layer.i} transform={`translate(${layer.dx.toFixed(3)},${layer.dy.toFixed(3)})`}>
              <path
                d={BAND_PATH}
                fill="none"
                stroke={layer.band}
                strokeWidth={BAND_STROKE_WIDTH}
                strokeLinejoin="miter"
                strokeMiterlimit={BAND_MITER_LIMIT}
                strokeLinecap="butt"
              />
              <g transform={MONOGRAM_TRANSFORM} fill={layer.letter}>
                <rect x="34" y="39" width="14" height="42" />
                <path d={MONOGRAM_C_PATH} />
              </g>
            </g>
          ))}

          {/* Face. Band gradient as a masked fill, never as a stroke — a
              gradient on a stroke renders flat in several rasterisers. */}
          <rect width="120" height="120" fill={`url(#${gradId})`} mask={`url(#${maskId})`} />
          <rect width="120" height="120" fill={`url(#${glossId})`} mask={`url(#${maskId})`} />

          <g transform={MONOGRAM_TRANSFORM} fill={`url(#${monoGradId})`}>
            <rect x="34" y="39" width="14" height="42" />
            <path d={MONOGRAM_C_PATH} />
          </g>

          {/* Specular catches on the two lit edges. */}
          <g style={{ mixBlendMode: "screen" }} fill="none">
            <path
              d="M43,17.6 L60,7.8 L104,33.2"
              stroke="rgba(255,255,255,.85)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path d="M16.6,84 L16.6,35" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </span>
  );
}
