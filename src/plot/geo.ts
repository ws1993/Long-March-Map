/**
 * 平面几何工具 —— 态势标绘的数值基础。
 *
 * 所有标绘计算都在 Web Mercator 米制平面里完成：
 *   - 保证"箭头宽度 8 公里"这类参数在地图上量得准；
 *   - 避免在经纬度空间里直接做旋转/法向运算带来的形变。
 * 计算结束后再反投影回经纬度，交给 maplibre 渲染。
 */

export type LonLat = [number, number];
export interface Pt {
  x: number;
  y: number;
}

const R = 6378137;
const D = Math.PI / 180;

export function project(ll: LonLat): Pt {
  const [lon, lat] = ll;
  const x = R * lon * D;
  const clamped = Math.max(-85.05, Math.min(85.05, lat));
  const y = R * Math.log(Math.tan(Math.PI / 4 + (clamped * D) / 2));
  return { x, y };
}

export function unproject(p: Pt): LonLat {
  const lon = p.x / R / D;
  const lat = (2 * Math.atan(Math.exp(p.y / R)) - Math.PI / 2) / D;
  return [lon, lat];
}

export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const len = (a: Pt): number => Math.hypot(a.x, a.y);

export function normalize(a: Pt): Pt {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** 左法向（把切向量逆时针转 90°） */
export const leftNormal = (a: Pt): Pt => ({ x: -a.y, y: a.x });

export function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 折线累计长度表 */
export function cumulative(path: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + len(sub(path[i], path[i - 1])));
  return out;
}

/**
 * 沿折线按固定间距重采样。
 * 保证首尾点保留，且所有采样点落在原始折线上（不会切角）。
 */
export function resample(path: Pt[], step: number): Pt[] {
  if (path.length < 2) return path.slice();
  const cum = cumulative(path);
  const total = cum[cum.length - 1];
  if (total === 0) return [path[0]];
  const n = Math.max(2, Math.ceil(total / step) + 1);
  const out: Pt[] = [];
  let seg = 1;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (seg < path.length - 1 && cum[seg] < target) seg++;
    const t0 = cum[seg - 1];
    const t1 = cum[seg];
    const t = t1 === t0 ? 0 : (target - t0) / (t1 - t0);
    out.push(lerpPt(path[seg - 1], path[seg], t));
  }
  return out;
}

/** 每个采样点处的单位切向量（中心差分，端点用单侧） */
export function tangents(pts: Pt[]): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    if (n === 1) {
      out.push({ x: 1, y: 0 });
      continue;
    }
    if (i === 0) out.push(normalize(sub(pts[1], pts[0])));
    else if (i === n - 1) out.push(normalize(sub(pts[n - 1], pts[n - 2])));
    else out.push(normalize(sub(pts[i + 1], pts[i - 1])));
  }
  return out;
}

/** 平滑折线（Chaikin 切角），用于让手绘路径更自然 */
export function chaikin(path: Pt[], iterations = 2): Pt[] {
  let cur = path;
  for (let k = 0; k < iterations; k++) {
    if (cur.length < 3) return cur;
    const next: Pt[] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i];
      const b = cur[i + 1];
      next.push(lerpPt(a, b, 0.25), lerpPt(a, b, 0.75));
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

/** 二次贝塞尔采样 */
export function quadBezier(a: Pt, c: Pt, b: Pt, samples = 48): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    out.push({
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    });
  }
  return out;
}

/** 多边形面积（正负表示绕向） */
export function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  return a / 2;
}

/** 统一为逆时针绕向（GeoJSON / maplibre 的 fill 更稳定） */
export function ensureCCW(poly: Pt[]): Pt[] {
  return signedArea(poly) < 0 ? poly.slice().reverse() : poly;
}

export const toLL = (pts: Pt[]): LonLat[] => pts.map(unproject);
export const fromLL = (lls: LonLat[]): Pt[] => lls.map(project);
