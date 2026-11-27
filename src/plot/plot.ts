/**
 * 军事态势标绘（Plot）几何库 · 经典军史图集精致版（支持 `progress ∈ [0, 1]` 渐进生长）。
 *
 * 几何工艺要点：
 * 1. 微弧曲率：两点直连路径自动注入柔和法向微弧，多点路径经三次 Chaikin 切角平滑，消除生硬折角；
 * 2. 军标燕尾倒钩箭：箭首采用后掠倒钩锐角双翼 + 刃口微内弧，箭尾收为燕尾内凹口，并输出中轴高光脊线；
 * 3. 细轨间隔刺齿防线：采用纤细实心基线配等距间隔的紧凑三角刺齿（───▲───▲───），取代粗大空心锯齿。
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
  /** 箭身颈部基准宽度（米） */
  width: number;
  /** 箭头最大翼展（米），默认 width 的 2.15 倍 */
  headWidth?: number;
  /** 箭头长度（沿轴向，米），默认 width 的 2.85 倍 */
  headLength?: number;
  /** 尾部宽度比例（0~1），默认 0.42 */
  tailTaper?: number;
  /** 路径平滑迭代次数 */
  smooth?: number;
  /** 两点直连时的自动微弧曲率（正偏左、负偏右），默认 0.08 */
  arcRatio?: number;
}

export interface ArrowGeometryResult {
  ring: LonLat[];
  spine: LonLat[];
}

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

export function sliceLineLL(pathLL: LonLat[], progress = 1): LonLat[] {
  if (progress >= 0.999) return pathLL;
  const sliced = sliceProjected(fromLL(pathLL), progress);
  return sliced.length >= 2 ? toLL(sliced) : [];
}

/** 取折线在归一化弧长位置处的地理坐标及屏幕法向参考点 */
export function pointAlongLL(pathLL: LonLat[], ratio = 0.5): LonLat | null {
  if (pathLL.length === 0) return null;
  if (pathLL.length === 1) return pathLL[0];
  const pts = fromLL(pathLL);
  const cum = cumulative(pts);
  const p = pointAt(pts, cum, cum[cum.length - 1] * Math.max(0, Math.min(1, ratio)));
  return toLL([p])[0];
}

/** 为两点直线注入自然微弧，多点折线做三次平滑 */
function buildOrganicCenterline(raw: Pt[], smoothIter: number, arcRatio: number): Pt[] {
  if (raw.length === 2 && Math.abs(arcRatio) > 0.001) {
    const a = raw[0];
    const b = raw[1];
    const axis = sub(b, a);
    const L = len(axis);
    if (L > 1) {
      const n = leftNormal(normalize(axis));
      const ctrl = add(lerpPt(a, b, 0.5), scale(n, L * arcRatio));
      return quadBezier(a, ctrl, b, 36);
    }
  }
  return smoothPath(raw, smoothIter);
}

/** 生成军标燕尾后掠倒钩箭头及其内部中轴脊线 */
export function attackArrowDetailed(
  pathLL: LonLat[],
  style: ArrowStyle,
  progress = 1,
): ArrowGeometryResult {
  if (progress <= 0.025) return { ring: [], spine: [] };
  const {
    width,
    headWidth = width * 2.15,
    headLength = width * 2.85,
    tailTaper = 0.42,
    smooth = 3,
    arcRatio = 0.075,
  } = style;

  const raw = fromLL(pathLL);
  if (raw.length < 2) return { ring: [], spine: [] };

  const fullSmooth = buildOrganicCenterline(raw, smooth, arcRatio);
  const pts = sliceProjected(fullSmooth, Math.min(1, progress));
  if (pts.length < 2) return { ring: [], spine: [] };

  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  if (total < 1) return { ring: [], spine: [] };

  const growScale = Math.min(1, 0.48 + 0.52 * progress);
  const effWidth = width * growScale;
  const effHeadWidth = headWidth * growScale;
  const headLen = Math.min(headLength * growScale, total * 0.48);
  const shaftEnd = Math.max(total * 0.12, total - headLen);

  const shaftPts: Pt[] = [];
  const step = Math.max(effWidth * 0.32, total / 180);
  for (let i = 0; i < pts.length; i++) {
    if (cum[i] < shaftEnd) shaftPts.push(pts[i]);
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
    // 微凹曲线展宽，使箭身由纤细箭尾优雅过渡到箭颈
    const halfW = (effWidth / 2) * (tailTaper + (1 - tailTaper) * Math.pow(t, 0.86));
    const n = leftNormal(tgn[i]);
    leftSide.push(add(dense[i], scale(n, halfW)));
    rightSide.push(add(dense[i], scale(n, -halfW)));
  }

  // 后掠倒钩箭首 + 刃口微内弧
  const tip = pts[pts.length - 1];
  const tipTangent = normalize(sub(tip, endPt));
  const effTipTan = len(tipTangent) > 0 ? tipTangent : tgn[nDense - 1];
  const nTip = leftNormal(effTipTan);
  const barbSweep = headLen * 0.24;

  const wingL = add(add(endPt, scale(effTipTan, -barbSweep)), scale(nTip, effHeadWidth / 2));
  const wingR = add(add(endPt, scale(effTipTan, -barbSweep)), scale(nTip, -effHeadWidth / 2));

  const bladeCtrlL = add(lerpPt(wingL, tip, 0.52), scale(nTip, -effHeadWidth * 0.045));
  const bladeCtrlR = add(lerpPt(tip, wingR, 0.48), scale(nTip, effHeadWidth * 0.045));
  const bladeL = quadBezier(wingL, bladeCtrlL, tip, 6).slice(1, -1);
  const bladeR = quadBezier(tip, bladeCtrlR, wingR, 6).slice(1, -1);

  // 燕尾内凹口
  const notchDepth = Math.min(effWidth * tailTaper * 0.92, shaftEnd * 0.22);
  const tailNotch = add(dense[0], scale(tgn[0], notchDepth));

  const poly = [
    tailNotch,
    ...leftSide,
    wingL,
    ...bladeL,
    tip,
    ...bladeR,
    wingR,
    ...rightSide.slice().reverse(),
  ];

  // 中轴高光脊线：从燕尾凹口前方延伸至箭头内部
  const spineStart = Math.min(shaftEnd * 0.85, notchDepth * 1.5);
  const spineEnd = Math.max(spineStart + 1, total - headLen * 0.28);
  const spinePts: Pt[] = [pointAt(pts, cum, spineStart)];
  for (let i = 1; i < pts.length - 1; i++) {
    if (cum[i] > spineStart && cum[i] < spineEnd) spinePts.push(pts[i]);
  }
  spinePts.push(pointAt(pts, cum, spineEnd));

  return {
    ring: toLL(dedupe(ensureCCW(poly))),
    spine: spinePts.length >= 2 ? toLL(dedupe(spinePts)) : [],
  };
}

/** 兼容单环返回接口 */
export function attackArrow(pathLL: LonLat[], style: ArrowStyle, progress = 1): LonLat[] {
  return attackArrowDetailed(pathLL, style, progress).ring;
}

/** 钳击 / 合围双箭头：两翼对称弧线包抄合拢，同时返回中轴脊线 */
export function pincerArrowsDetailed(
  startLL: LonLat,
  endLL: LonLat,
  style: ArrowStyle & { spread?: number; spreadRatio?: number },
  progress = 1,
): ArrowGeometryResult[] {
  if (progress <= 0.025) return [];
  const { width, spread, spreadRatio = 0.4, headWidth = width * 2.1, headLength = width * 2.75 } = style;
  const a = project(startLL);
  const b = project(endLL);
  const axis = sub(b, a);
  const L = len(axis);
  if (L < 1) return [];
  const dir = normalize(axis);
  const n = leftNormal(dir);
  const spreadDist = spread ?? L * spreadRatio;

  const out: ArrowGeometryResult[] = [];
  for (const sign of [1, -1]) {
    const ctrl = add(add(a, scale(dir, L * 0.46)), scale(n, sign * spreadDist));
    const curve = quadBezier(a, ctrl, b, 48);
    const res = attackArrowDetailed(
      toLL(curve),
      { width, headWidth, headLength, tailTaper: 0.34, smooth: 0, arcRatio: 0 },
      progress,
    );
    if (res.ring.length > 2) out.push(res);
  }
  return out;
}

export function pincerArrows(
  startLL: LonLat,
  endLL: LonLat,
  style: ArrowStyle & { spread?: number; spreadRatio?: number },
  progress = 1,
): LonLat[][] {
  return pincerArrowsDetailed(startLL, endLL, style, progress).map((r) => r.ring);
}

/** 部队集结地：旋转椭圆 */
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
    pts.push({ x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos });
  }
  return toLL(ensureCCW(pts));
}

/**
 * 防御封锁阵地：细实心基线 + 等距间隔紧凑三角刺齿（───▲───▲───）。
 * 相比旧版相连大空心锯齿，视觉更纤巧锐利、不遮挡底图与路线。
 */
export function defenseLine(pathLL: LonLat[], toothSize: number, side: 1 | -1 = 1, progress = 1): LonLat[] {
  if (progress <= 0.03) return [];
  const raw = smoothPath(fromLL(pathLL), 2);
  const sliced = sliceProjected(raw, Math.min(1, progress));
  if (sliced.length < 2) return [];

  const pitch = Math.max(toothSize * 0.95, 700);
  const pts = resample(sliced, pitch);
  if (pts.length < 2) return [];
  const tgn = tangents(pts);

  const halfBase = toothSize * 0.075;
  const toothHeight = toothSize * 0.46;

  const outline: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const n = leftNormal(tgn[i]);
    outline.push(add(pts[i], scale(n, side * halfBase)));
    if (i < pts.length - 1) {
      const segVec = sub(pts[i + 1], pts[i]);
      const segLen = len(segVec);
      const dir = normalize(segVec);
      const nMid = leftNormal(dir);
      // 仅取每段中央 36% 宽度立起锐利短刺齿，两侧留出平整基线间隔
      if (segLen > toothSize * 0.35) {
        const b0 = lerpPt(pts[i], pts[i + 1], 0.32);
        const mid = lerpPt(pts[i], pts[i + 1], 0.5);
        const b1 = lerpPt(pts[i], pts[i + 1], 0.68);
        outline.push(add(b0, scale(nMid, side * halfBase)));
        outline.push(add(mid, scale(nMid, side * (halfBase + toothHeight))));
        outline.push(add(b1, scale(nMid, side * halfBase)));
      }
    }
  }

  for (let i = pts.length - 1; i >= 0; i--) {
    const n = leftNormal(tgn[i]);
    outline.push(add(pts[i], scale(n, -side * halfBase)));
  }
  return toLL(ensureCCW(dedupe(outline)));
}

/** 阻击 / 关隘封锁点：精致内凹四角星菱标 */
export function blockPoint(centerLL: LonLat, size: number, rotationDeg = 0, progress = 1): LonLat[] {
  if (progress <= 0.02) return [];
  const k = 0.65 + 0.35 * Math.min(1, progress);
  const c = project(centerLL);
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const s = size * k * 0.72;
  const inner = s * 0.28;
  const raw: Pt[] = [
    { x: 0, y: s },
    { x: inner, y: inner },
    { x: s * 0.78, y: 0 },
    { x: inner, y: -inner },
    { x: 0, y: -s },
    { x: -inner, y: -inner },
    { x: -s * 0.78, y: 0 },
    { x: -inner, y: inner },
  ];
  const pts = raw.map((p) => ({ x: c.x + p.x * cos - p.y * sin, y: c.y + p.x * sin + p.y * cos }));
  return toLL(ensureCCW(pts));
}

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
