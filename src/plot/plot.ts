/**
 * 军事态势标绘（Plot）几何库 —— maplibre 自绘方案的核心实现。
 *
 * 支持图形：
 *   attackArrow   进攻箭头（多点曲线箭身 + 三角箭头，可设燕尾收窄）
 *   doubleArrow   钳击/合围双箭头（两翼对称合击）
 *   assembleArea  部队集结地（旋转椭圆，可带兵力注记）
 *   defenseLine   防御阵地（折线 + 朝敌一侧的锯齿）
 *   axisLine      行动轴线（细虚线，带箭头）
 *   blockPoint    阻击/伏击点（菱形钳口）
 *
 * 设计取舍：本项目态势图是"史料静态回放"，图形参数全部预定义在 JSON 里，
 * 不需要用户交互式绘点。因此只实现几何生成 + GeoJSON 输出，不实现编辑交互，
 * 也就不必引入 ol-plot 的 OL 控件体系（详见 docs/00-tech-stack.md）。
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

/** 进攻箭头：沿路径生成带宽度渐变的箭身，末端接三角箭头 */
export function attackArrow(pathLL: LonLat[], style: ArrowStyle): LonLat[] {
  const { width, headWidth = width * 2.6, headLength = width * 3.4, tailTaper = 0.5, smooth = 2 } = style;
  const path = fromLL(pathLL);
  if (path.length < 2) return [];

  let pts = smoothPath(path, smooth);
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  if (total < 1) return [];

  // 箭头长度不能超过路径总长的一半，否则缩到 40%
  const headLen = Math.min(headLength, total * 0.55);
  const shaftEnd = Math.max(0, total - headLen);

  // 1) 箭身：从起点到 shaftEnd，宽度由 tailTaper → 1 线性过渡
  const shaftPts: Pt[] = [];
  const step = Math.max(width * 0.35, total / 240);
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
    const halfW = (width / 2) * (tailTaper + (1 - tailTaper) * t);
    const n = leftNormal(tgn[i]);
    leftSide.push(add(dense[i], scale(n, halfW)));
    rightSide.push(add(dense[i], scale(n, -halfW)));
  }

  // 2) 箭头：在箭身末端向外扩到 headWidth/2，再收到路径终点
  const tip = pts[pts.length - 1];
  const tipTangent = tangents([dense[nDense - 1], tip])[1] ?? tgn[nDense - 1];
  const nTip = leftNormal(tipTangent);
  const wingL = add(endPt, scale(nTip, headWidth / 2));
  const wingR = add(endPt, scale(nTip, -headWidth / 2));

  const poly = [...leftSide, wingL, tip, wingR, ...rightSide.slice().reverse()];
  return toLL(dedupe(ensureCCW(poly)));
}

/** 钳击 / 合围双箭头：从起点向两侧张开，两翼在目标点附近合拢 */
export function pincerArrows(
  startLL: LonLat,
  endLL: LonLat,
  style: ArrowStyle & { spread?: number; spreadRatio?: number },
): LonLat[][] {
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
    // 控制点：轴线中段向一侧偏移，形成外弧
    const ctrl = add(add(a, scale(dir, L * 0.45)), scale(n, sign * spreadDist));
    const curve = quadBezier(a, ctrl, b, 64);
    out.push(attackArrow(toLL(curve), { width, headWidth, headLength, tailTaper: 0.25 }));
  }
  return out;
}

/** 部队集结地：旋转椭圆 */
export function assembleArea(centerLL: LonLat, radiusX: number, radiusY: number, rotationDeg = 0, segments = 48): LonLat[] {
  const c = project(centerLL);
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const pts: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radiusX;
    const y = Math.sin(a) * radiusY;
    pts.push({ x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos });
  }
  return toLL(ensureCCW(pts));
}

/** 防御阵地：折线 + 朝敌（右侧）的锯齿 */
export function defenseLine(pathLL: LonLat[], toothSize: number, side: 1 | -1 = 1): LonLat[] {
  // 采样步长必须明显小于齿宽，否则短防线上只会出现一两个孤立的齿
  const pts = resample(fromLL(pathLL), Math.max(toothSize * 0.85, 600));
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
  // 回程沿另一侧闭合
  for (let i = pts.length - 1; i >= 0; i--) {
    const n = leftNormal(tgn[i]);
    outline.push(add(pts[i], scale(n, -side * toothSize * 0.18)));
  }
  return toLL(ensureCCW(outline));
}

/** 阻击 / 伏击点：菱形钳口 */
export function blockPoint(centerLL: LonLat, size: number, rotationDeg = 0): LonLat[] {
  const c = project(centerLL);
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const raw: Pt[] = [
    { x: 0, y: size * 0.95 },
    { x: size * 0.5, y: 0 },
    { x: 0, y: -size * 0.95 },
    { x: -size * 0.5, y: 0 },
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

/** 折线上按弧长取点 */
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
