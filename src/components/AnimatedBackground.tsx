import { motion, motionValue, useAnimationFrame } from "framer-motion";
import type { HTMLMotionProps, MotionValue } from "framer-motion";
import type { CSSProperties } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Têtes de base — `public/upload/` (PNG par défaut, repli .jpg / .jpeg). */
const BASE_HEADS = [
  "/upload/lalia-1.png",
  "/upload/lalia-2.png",
  "/upload/lalia-3.png",
  "/upload/lauriane-1.png",
  "/upload/lauriane-2.png",
  "/upload/lauriane-3.png",
] as const;

/** 6 × 1,5 = 9 photos (on réutilise les 3 premières). */
const HEAD_SOURCES: string[] = [...BASE_HEADS, BASE_HEADS[0], BASE_HEADS[1], BASE_HEADS[2]];

type Zone = {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  width: string;
};

const HEAD_COUNT = HEAD_SOURCES.length;
const FACE_WIDTH = "min(15vw, 124px)";

type Pt = { top: number; left: number };

const FALLBACK: Pt[] = [
  { top: 6, left: 6 },
  { top: 8, left: 44 },
  { top: 6, left: 78 },
  { top: 40, left: 10 },
  { top: 44, left: 48 },
  { top: 42, left: 82 },
  { top: 22, left: 28 },
  { top: 58, left: 52 },
  { top: 72, left: 18 },
];

function randomNonOverlappingZones(): Zone[] {
  const minDist = 12.5;
  const anchors: Pt[] = [];

  for (let k = 0; k < HEAD_COUNT; k++) {
    let placed: Pt | null = null;
    for (let attempt = 0; attempt < 500; attempt++) {
      const top = 3 + Math.random() * 78;
      const left = 2 + Math.random() * 76;
      const p = { top, left };
      if (anchors.every((q) => Math.hypot(p.top - q.top, p.left - q.left) >= minDist)) {
        placed = p;
        break;
      }
    }
    anchors.push(placed ?? FALLBACK[k]);
  }

  return anchors.map((p) => ({
    top: `${p.top}%`,
    left: `${p.left}%`,
    width: FACE_WIDTH,
  }));
}

function shuffleImages(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function headRotation(index: number) {
  return {
    animate: { rotate: [-45, 45] },
    transition: {
      duration: 1.2 + (index % 5) * 0.38,
      repeat: Infinity,
      repeatType: "reverse" as const,
      ease: "linear" as const,
      delay: index * 0.06,
    },
  };
}

/** Au-dessus de cette largeur, les têtes repoussent la zone du quiz ; en dessous, elles peuvent passer derrière les cartes (z-index). */
const FORM_EXCLUSION_MIN_WIDTH = 768;

function getFormExclusionZone(vw: number, vh: number) {
  const horizontalPad = 24;
  const boxW = Math.min(580, vw - horizontalPad);
  const boxH = Math.min(vh * 0.82, 760);
  const ex = (vw - boxW) / 2;
  const ey = (vh - boxH) / 2;
  const gap = 10;
  return { ex, ey, ew: boxW, eh: boxH, gap };
}

function pushOutOfFormZone(
  tx: number,
  ty: number,
  W: number,
  H: number,
  vw: number,
  vh: number
): { tx: number; ty: number; hit: boolean; normX?: number; normY?: number } {
  if (vw <= FORM_EXCLUSION_MIN_WIDTH) {
    return { tx, ty, hit: false };
  }

  const { ex, ey, ew, eh, gap } = getFormExclusionZone(vw, vh);
  const bx1 = ex - gap;
  const by1 = ey - gap;
  const bx2 = ex + ew + gap;
  const by2 = ey + eh + gap;

  const ax2 = tx + W;
  const ay2 = ty + H;
  if (ax2 <= bx1 || tx >= bx2 || ay2 <= by1 || ty >= by2) {
    return { tx, ty, hit: false };
  }

  const ol = ax2 - bx1;
  const or = bx2 - tx;
  const ot = ay2 - by1;
  const ob = by2 - ty;
  const m = Math.min(ol, or, ot, ob);

  let ntx = tx;
  let nty = ty;
  if (m === ol) ntx = tx - ol;
  else if (m === or) ntx = tx + or;
  else if (m === ot) nty = ty - ot;
  else nty = ty + ob;

  const dirX = ntx - tx;
  const dirY = nty - ty;
  const len = Math.hypot(dirX, dirY) || 1;
  return {
    tx: ntx,
    ty: nty,
    hit: true,
    normX: dirX / len,
    normY: dirY / len,
  };
}

type FacePhys = {
  bx: MotionValue<number>;
  by: MotionValue<number>;
  repelX: MotionValue<number>;
  repelY: MotionValue<number>;
  vx: number;
  vy: number;
};

function createPhysStore(): FacePhys[] {
  return Array.from({ length: HEAD_COUNT }, (_, i) => ({
    bx: motionValue(0),
    by: motionValue(0),
    repelX: motionValue(0),
    repelY: motionValue(0),
    vx: 42 + (i % 6) * 14,
    vy: -38 - (i % 5) * 11,
  }));
}

type LayoutRect = { L: number; T: number; W: number; H: number };

function repelPair(
  cx: number,
  cy: number,
  mx: number,
  my: number
): { rx: number; ry: number } {
  const dx = cx - mx;
  const dy = cy - my;
  const dist = Math.hypot(dx, dy);
  const maxR = 150;
  const maxPush = 28;
  if (dist < maxR && dist > 0.5) {
    const t = 1 - dist / maxR;
    const f = t * t * maxPush;
    return { rx: (dx / dist) * f, ry: (dy / dist) * f };
  }
  return { rx: 0, ry: 0 };
}

/** Collisions circulaires (rayon ~ moitié du plus petit côté), masses égales. */
function resolveFaceCollision(
  a: FacePhys,
  b: FacePhys,
  la: LayoutRect,
  lb: LayoutRect,
  rxA: number,
  ryA: number,
  rxB: number,
  ryB: number
) {
  const ra = (Math.min(la.W, la.H) / 2) * 0.92;
  const rb = (Math.min(lb.W, lb.H) / 2) * 0.92;

  const ax = la.L + a.bx.get() + rxA + la.W / 2;
  const ay = la.T + a.by.get() + ryA + la.H / 2;
  const bx = lb.L + b.bx.get() + rxB + lb.W / 2;
  const by = lb.T + b.by.get() + ryB + lb.H / 2;

  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  const minD = ra + rb;
  if (d >= minD || d < 1e-4) return;

  const nx = dx / d;
  const ny = dy / d;
  const overlap = minD - d;
  const sep = overlap * 0.52 + 0.35;

  a.bx.set(a.bx.get() - nx * sep);
  a.by.set(a.by.get() - ny * sep);
  b.bx.set(b.bx.get() + nx * sep);
  b.by.set(b.by.get() + ny * sep);

  const vaN = a.vx * nx + a.vy * ny;
  const vbN = b.vx * nx + b.vy * ny;
  const rel = vaN - vbN;
  if (rel < 0) {
    const e = 0.88;
    const imp = (-(1 + e) * rel) / 2;
    a.vx += imp * nx;
    a.vy += imp * ny;
    b.vx -= imp * nx;
    b.vy -= imp * ny;
  }
}

export function AnimatedBackground() {
  const mouseRef = useRef({ x: -1e4, y: -1e4 });

  const physRef = useRef<FacePhys[] | null>(null);
  if (!physRef.current) physRef.current = createPhysStore();

  const layoutsRef = useRef<LayoutRect[]>(
    Array.from({ length: HEAD_COUNT }, () => ({ L: 0, T: 0, W: 1, H: 1 }))
  );

  const setAnchorLayout = useCallback((index: number, r: LayoutRect) => {
    layoutsRef.current[index] = r;
  }, []);

  useLayoutEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const placements = useMemo(() => {
    const zones = randomNonOverlappingZones();
    const imgs = shuffleImages([...HEAD_SOURCES]);
    return zones.map((zone, i) => ({
      src: imgs[i],
      zone,
      index: i,
    }));
  }, []);

  const margin = 6;

  useAnimationFrame((_, delta) => {
    const phys = physRef.current;
    if (!phys) return;

    const dt = Math.min(delta / 1000, 0.045);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    const n = phys.length;
    const repelRx: number[] = new Array(n);
    const repelRy: number[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const lay = layoutsRef.current[i];
      if (lay.W < 2) continue;
      const cx = lay.L + phys[i].bx.get() + lay.W / 2;
      const cy = lay.T + phys[i].by.get() + lay.H / 2;
      const { rx, ry } = repelPair(cx, cy, mx, my);
      repelRx[i] = rx;
      repelRy[i] = ry;
      phys[i].repelX.set(rx);
      phys[i].repelY.set(ry);
    }

    for (let i = 0; i < n; i++) {
      const lay = layoutsRef.current[i];
      if (lay.W < 2) continue;
      const p = phys[i];
      let bx = p.bx.get() + p.vx * dt;
      let by = p.by.get() + p.vy * dt;
      p.bx.set(bx);
      p.by.set(by);
    }

    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const la = layoutsRef.current[i];
          const lb = layoutsRef.current[j];
          if (la.W < 2 || lb.W < 2) continue;
          resolveFaceCollision(
            phys[i],
            phys[j],
            la,
            lb,
            repelRx[i],
            repelRy[i],
            repelRx[j],
            repelRy[j]
          );
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const lay = layoutsRef.current[i];
      if (lay.W < 2) continue;
      const p = phys[i];
      const { L, T, W, H } = lay;
      const rx = repelRx[i];
      const ry = repelRy[i];

      let bx = p.bx.get();
      let by = p.by.get();

      let tx = L + bx + rx;
      let ty = T + by + ry;

      const minLeft = margin;
      const maxLeft = vw - margin - W;
      const minTop = margin;
      const maxTop = vh - margin - H;

      if (maxLeft >= minLeft && maxTop >= minTop) {
        if (tx < minLeft) {
          bx = minLeft - L - rx;
          p.vx = Math.abs(p.vx) * 0.98;
        } else if (tx > maxLeft) {
          bx = maxLeft - L - rx;
          p.vx = -Math.abs(p.vx) * 0.98;
        }
        if (ty < minTop) {
          by = minTop - T - ry;
          p.vy = Math.abs(p.vy) * 0.98;
        } else if (ty > maxTop) {
          by = maxTop - T - ry;
          p.vy = -Math.abs(p.vy) * 0.98;
        }

        tx = L + bx + rx;
        ty = T + by + ry;
        if (tx < minLeft) bx = minLeft - L - rx;
        if (tx > maxLeft) bx = maxLeft - L - rx;
        if (ty < minTop) by = minTop - T - ry;
        if (ty > maxTop) by = maxTop - T - ry;

        tx = L + bx + rx;
        ty = T + by + ry;

        const formPush = pushOutOfFormZone(tx, ty, W, H, vw, vh);
        if (formPush.hit) {
          bx = formPush.tx - L - rx;
          by = formPush.ty - T - ry;
          if (formPush.normX != null && formPush.normY != null) {
            const dot = p.vx * formPush.normX + p.vy * formPush.normY;
            if (dot < 0) {
              p.vx -= 2 * dot * formPush.normX;
              p.vy -= 2 * dot * formPush.normY;
              p.vx *= 0.96;
              p.vy *= 0.96;
            }
          }
          tx = L + bx + rx;
          ty = T + by + ry;
          if (tx < minLeft) bx = minLeft - L - rx;
          if (tx > maxLeft) bx = maxLeft - L - rx;
          if (ty < minTop) by = minTop - T - ry;
          if (ty > maxTop) by = maxTop - T - ry;
        }
      }

      p.bx.set(bx);
      p.by.set(by);

      p.vx *= 0.9995;
      p.vy *= 0.9995;
      const minSpeed = 28;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < minSpeed && sp > 0.01) {
        const f = minSpeed / sp;
        p.vx *= f;
        p.vy *= f;
      }
    }
  });

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        isolation: "isolate",
      }}
    >
      {/* Blobs d’angle + cadre (tons pêche / corail / rose plus marqués) */}
      <div
        style={{
          position: "absolute",
          top: "-14%",
          left: "-10%",
          width: "min(56vw, 460px)",
          height: "min(56vw, 460px)",
          background:
            "radial-gradient(ellipse 70% 65% at 42% 38%, rgba(255, 150, 130, 0.85) 0%, rgba(255, 190, 200, 0.5) 48%, transparent 72%)",
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-12%",
          right: "-8%",
          width: "min(62vw, 500px)",
          height: "min(62vw, 500px)",
          background:
            "radial-gradient(ellipse 68% 62% at 58% 52%, rgba(255, 160, 175, 0.82) 0%, rgba(255, 200, 180, 0.42) 52%, transparent 74%)",
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-6%",
          right: "-12%",
          width: "min(48vw, 380px)",
          height: "min(48vw, 380px)",
          background:
            "radial-gradient(ellipse 65% 60% at 55% 40%, rgba(255, 120, 100, 0.55) 0%, rgba(255, 200, 160, 0.35) 55%, transparent 70%)",
          filter: "blur(3px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-4%",
          left: "-14%",
          width: "min(50vw, 400px)",
          height: "min(50vw, 400px)",
          background:
            "radial-gradient(ellipse 62% 58% at 35% 60%, rgba(255, 130, 150, 0.5) 0%, rgba(255, 210, 190, 0.32) 56%, transparent 72%)",
          filter: "blur(3px)",
        }}
      />
      <div
        className="evjf-floating-faces"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          opacity: 0.97,
        }}
      >
        {placements.map(({ src, zone, index }) => (
          <FaceBlob
            key={`${index}-${src}-${zone.top}-${zone.left}`}
            src={src}
            zone={zone}
            index={index}
            phys={physRef.current![index]}
            onAnchorLayout={setAnchorLayout}
          />
        ))}
      </div>
    </div>
  );
}

/** Halos néon par portrait (bleu, violet, jaune, vert, orange, mauve). */
const NEON_FILTERS: string[] = [
  "drop-shadow(0 0 6px rgba(77, 150, 255, 1)) drop-shadow(0 0 18px rgba(77, 150, 255, 0.65))",
  "drop-shadow(0 0 6px rgba(192, 132, 252, 1)) drop-shadow(0 0 18px rgba(192, 132, 252, 0.65))",
  "drop-shadow(0 0 6px rgba(255, 214, 80, 1)) drop-shadow(0 0 18px rgba(255, 200, 90, 0.6))",
  "drop-shadow(0 0 6px rgba(107, 203, 119, 1)) drop-shadow(0 0 18px rgba(107, 203, 119, 0.65))",
  "drop-shadow(0 0 6px rgba(255, 122, 69, 1)) drop-shadow(0 0 18px rgba(255, 122, 69, 0.6))",
  "drop-shadow(0 0 6px rgba(155, 89, 182, 1)) drop-shadow(0 0 18px rgba(155, 89, 182, 0.62))",
];

function FaceBlob({
  src,
  zone,
  index,
  phys,
  onAnchorLayout,
}: {
  src: string;
  zone: Zone;
  index: number;
  phys: FacePhys;
  onAnchorLayout: (index: number, r: LayoutRect) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);

  const updateLayout = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onAnchorLayout(index, { L: r.left, T: r.top, W: r.width, H: r.height });
  }, [index, onAnchorLayout]);

  useLayoutEffect(() => {
    updateLayout();
    window.addEventListener("resize", updateLayout);
    const el = anchorRef.current;
    const ro = new ResizeObserver(() => updateLayout());
    if (el) ro.observe(el);
    return () => {
      window.removeEventListener("resize", updateLayout);
      if (el) ro.unobserve(el);
    };
  }, [updateLayout]);

  const { animate: rotAnimate, transition: rotTransition } = headRotation(index);

  return (
    <div
      ref={anchorRef}
      style={{
        position: "absolute",
        top: zone.top,
        bottom: zone.bottom,
        left: zone.left,
        right: zone.right,
        width: zone.width,
        maxWidth: "34vw",
      }}
    >
      <motion.div style={{ x: phys.bx, y: phys.by, willChange: "transform" }}>
        <motion.div
          style={{
            x: phys.repelX,
            y: phys.repelY,
            willChange: "transform",
          }}
        >
          <SmartHeadImg
            preferredSrc={src}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              filter: NEON_FILTERS[index % NEON_FILTERS.length],
              borderRadius: "50%",
              userSelect: "none",
            }}
            animate={rotAnimate}
            transition={rotTransition}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

function SmartHeadImg({
  preferredSrc,
  style,
  animate,
  transition,
}: {
  preferredSrc: string;
  style: CSSProperties;
  animate: HTMLMotionProps<"img">["animate"];
  transition: HTMLMotionProps<"img">["transition"];
}) {
  const [src, setSrc] = useState(preferredSrc);

  return (
    <motion.img
      src={src}
      alt=""
      draggable={false}
      style={style}
      animate={animate}
      transition={transition}
      onError={() => {
        if (src.endsWith(".png")) setSrc(preferredSrc.replace(/\.png$/i, ".jpg"));
        else if (src.endsWith(".jpg")) setSrc(preferredSrc.replace(/\.jpg$/i, ".jpeg"));
      }}
    />
  );
}
