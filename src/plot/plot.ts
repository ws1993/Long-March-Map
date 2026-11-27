/**
 * 军事态势标绘（Plot）几何库 —— 支持 `progress ∈ [0, 1]` 渐进生长动画。
 *
 * 支持图形：
 *   attackArrow   进攻箭头（沿平滑曲线按弧长从起点向尖端渐进伸展）
 *   pincerArrows  钳击/合围双箭头（两翼同步外弧包抄合拢）
 *   assembleArea  部队集结地（旋转椭圆）
 *   defenseLine   防御阵地（折线 + 朝敌一侧锯齿，可沿防线逐段展开）
 *   blockPoint    阻击/伏击点（菱形钳口）
 *   sliceLine     行动轴线/合围虚线按弧长渐进闭合
 */
import {
  type LonLat,
  type Pt,
  add,
  fromLL,
  cumulative,
  ensureCCW,
  leftNormal,
  len,
  lerpPt,
  normalize,
  project,
  quadBezier,
  resample,
  scale,
  sub,
  tangents,
  toLL,
} from './geo';

export interface ArrowStyle {
  /** 箭身宽度（米） */
  width: number;
  /** 箭头最大翼展（米），默认 width 的 2.6 倍 */
  headWidth?: number;
  /** 箭头长度（沿轴向，米），默认 width 的 3.4 倍 */
  headLength?: number;
  /** 尾部宽度比例（0~1）：0.35 表示尾端只有 35% 宽度，形成燕尾 */
  tailTaper?: number;
  /** 路径平滑层数 */
  smooth?: number;
}

/** 按归一化弧长比例 progress ∈ (0, 1] 截取投影折线 */
function sliceProjected(pts: Pt[], progress: number): Pt[] {
  if (pts.length < 2) return pts;
  if (progress >= 0.999) return pts;
  if (progress <= 0.015) return [];
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  if (total < 1) return [];
  const target = total * progress;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] < target) {
      out.push(pts[i]);
    } else {
      out.push(pointAt(pts, cum, target));
      break;
    }
  }
  return dedupe(out);
}

/** 经纬度折线按弧长比例截断（供合围虚线渐进闭合动画使用） */
export function sliceLineLL(pathLL: LonLat[], progress = 1): LonLat[] {
  if (progress >= 0.999) return pathLL;
  const sliced = sliceProjected(fromLL(pathLL), progress);
  return sliced.length >= 2 ? toLL(sliced) : [];
}

/** 取折线在归一化弧长位置处的点（用于箭头生长过程中锚定标签或前锋） */
export function pointAlongLL(pathLL: LonLat[], ratio = 0.5): LonLat | null {
  if (pathLL.length === 0) return null;
  if (pathLL.length === 1) return pathLL[0];
  const pts = fromLL(pathLL);
  const cum = cumulative(pts);
  const p = pointAt(pts, cum, cum[cum.length - 1] * Math.max(0, Math.min(1, ratio)));
  return toLL([p])[0];
}

/** 进攻箭头：先对全路径平滑再按 progress 截取弧长，保证生长过程中轨迹曲率稳定不抖动 */
export function attackArrow(pathLL: LonLat[], style: ArrowStyle, progress = 1): LonLat[] {
  if (progress <= 0.025) return [];
  const { width, headWidth = width * 2.6, headLength = width * 3.4, tailTaper = 0.5, smooth = 2 } = style;
  const raw = fromLL(pathLL);
  if (raw.length < 2) return [];

  const fullSmooth = smoothPath(raw, smooth);
  const pts = sliceProjected(fullSmooth, Math.min(1, progress));
  if (pts.length < 2) return [];

  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  if (total < 1) return [];

  // 初生阶段箭头尺寸随当前长度平滑放大，避免刚冒头就顶着巨大三角头
  const growScale = Math.min(1, 0.45 + 0.55 * progress);
  const effWidth = width * growScale;
  const effHeadWidth = headWidth * growScale;
  const headLen = Math.min(headLength * growScale, total * 0.55);
  const shaftEnd = Math.max(0, total - headLen);

  const shaftPts: Pt[] = [];
  const step = Math.max(effWidth * 0.35, total / 200);
  for (let i = 0; i < pts.length; i++) {
    if (cum[i] <= shaftEnd) shaftPts.push(pts[i]);
  }
  const endPt = pointAt(pts, cum, shaftEnd);
  shaftPts.push(endPt);
  const dense = resample(shaftPts, step);
  const tgn = tangents(dense);

  const leftSide: Pt[] = [];
  const rightSide: Pt[] = [];
  const nDense = dense.length;
  for (let i = 0; i < nDense; i++) {
    const t = nDense === 1 ? 1 : i / (nDense - 1);
    const halfW = (effWidth / 2) * (tailTaper + (1 - tailTaper) * t);
    const n = leftNormal(tgn[i]);
    leftSide.push(add(dense[i], scale(n, halfW)));
    rightSide.push(add(dense[i], scale(n, -halfW)));
  }

  const tip = pts[pts.length - 1];
  const tipTangent = tangents([dense[nDense - 1], tip])[1] ?? tgn[nDense - 1];
  const nTip = leftNormal(tipTangent);
  const wingL = add(endPt, scale(nTip, effHeadWidth / 2));
  const wingR = add(endPt, scale(nTip, -effHeadWidth / 2));

  const poly = [...leftSide, wingL, tip, wingR, ...rightSide.slice().reverse()];
  return toLL(dedupe(ensureCCW(poly)));
}

/** 钳击 / 合围双箭头：两翼随 progress 同步向外弧展开并在目标点合拢 */
export function pincerArrows(
  startLL: LonLat,
  endLL: LonLat,
  style: ArrowStyle & { spread?: number; spreadRatio?: number },
  progress = 1,
): LonLat[][] {
  if (progress <= 0.025) return [];
  const { width, spread, spreadRatio = 0.42, headWidth = width * 2.4, headLength = width * 3 } = style;
  const a = project(startLL);
  const b = project(endLL);
  const axis = sub(b, a);
  const L = len(axis);
  if (L < 1) return [];
  const dir = normalize(axis);
  const n = leftNormal(dir);
  const spreadDist = spread ?? L * spreadRatio;

  const out: LonLat[][] = [];
  for (const sign of [1, -1]) {
    const ctrl = add(add(a, scale(dir, L * 0.45)), scale(n, sign * spreadDist));
    const curve = quadBezier(a, ctrl, b, 56);
    const ring = attackArrow(toLL(curve), { width, headWidth, headLength, tailTaper: 0.25, smooth: 0 }, progress);
    if (ring.length > 2) out.push(ring);
  }
  return out;
}

/** 部队集结地：旋转椭圆（可随 progress 微幅展开） */
export function assembleArea(
  centerLL: LonLat,
  radiusX: number,
  radiusY: number,
  rotationDeg = 0,
  segments = 48,
  progress = 1,
): LonLat[] {
  if (progress <= 0.02) return [];
  const k = 0.72 + 0.28 * Math.min(1, progress);
  const c = project(centerLL);
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radiusX * k;
    const y = Math.sin(a) * radiusY * k;
    pts.push({ x: c.x + x * cos - y * sin, y: c.y + pY(x, y, cos, sin) });
  }
  return toLL(ensureCCW(pts));
}

function pY(x: number, y: number, cos: number, sin: number): number {
  return x * sin + y * cos;
}

/** 防御阵地：折线 + 朝敌一侧锯齿，随 progress 沿防线逐段铺开 */
export function defenseLine(pathLL: LonLat[], toothSize: number, side: 1 | -1 = 1, progress = 1): LonLat[] {
  if (progress <= 0.03) return [];
  const sliced = sliceProjected(fromLL(pathLL), Math.min(1, progress));
  if (sliced.length < 2) return [];
  const pts = resample(sliced, Math.max(toothSize * 0.85, 600));
  if (pts.length < 2) return [];
  const tgn = tangents(pts);
  const outline: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const n = leftNormal(tgn[i]);
    outline.push(add(pts[i], scale(n, side * toothSize * 0.18)));
    if (i < pts.length - 1) {
      const mid = lerpPt(pts[i], pts[i + 1], 0.5);
      const nMid = leftNormal(normalize(sub(pts[i + 1], pts[i])));
      outline.push(add(mid, scale(nMid, side * toothSize)));
      outline.push(add(mid, scale(nMid, side * toothSize * 0.18)));
    }
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const n = leftNormal(tgn[i]);
    outline.push(add(pts[i], scale(n, -side * toothSize * 0.18)));
  }
  return toLL(ensureCCW(outline));
}

/** 阻击 / 伏击点：菱形钳口 */
export function blockPoint(centerLL: LonLat, size: number, rotationDeg = 0, progress = 1): LonLat[] {
  if (progress <= 0.02) return [];
  const k = 0.6 + 0.4 * Math.min(1, progress);
  const c = project(centerLL);
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const s = size * k;
  const raw: Pt[] = [
    { x: 0, y: s * 0.95 },
    { x: s * 0.5, y: 0 },
    { x: 0, y: -s * 0.95 },
    { x: -s * 0.5, y: 0 },
  ];
  const pts = raw.map((p) => ({ x: c.x + p.x * cos - p.y * sin, y: c.y + p.x * sin + p.y * cos }));
  return toLL(ensureCCW(pts));
}

// ------------------------------------------------------------------ 内部工具

function smoothPath(path: Pt[], iterations: number): Pt[] {
  if (iterations <= 0 || path.length < 3) return path;
  let cur = path;
  for (let k = 0; k < iterations; k++) {
    const next: Pt[] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      next.push(lerpPt(cur[i], cur[i + 1], 0.25), lerpPt(cur[i], cur[i + 1], 0.75));
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

function pointAt(pts: Pt[], cum: number[], s: number): Pt {
  if (s <= 0) return pts[0];
  const total = cum[cum.length - 1];
  if (s >= total) return pts[pts.length - 1];
  let i = 1;
  while (i < cum.length && cum[i] < s) i++;
  const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return lerpPt(pts[i - 1], pts[i], t);
}

function dedupe(pts: Pt[], eps = 1e-6): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > eps || Math.abs(last.y - p.y) > eps) out.push(p);
  }
  return out;
}
