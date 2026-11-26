/**
 * 行军路线图层。
 *
 * 时间轴推进策略：把全部路线按当前日期切成三段
 *   past   —— 已经走过的整段（实色粗线 + 微光晕）
 *   active —— 正在走的那一段（截断到当前推进点，虚线流动动画）
 *   future —— 尚未走到的段（低透明度细线）
 * 每次日期变化只重建这三个小 GeoJSON（总量 < 50 段），代价很低。
 */
import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import type { Army, RouteSegment } from '../data/types';
import { armies } from '../data/armies';
import { routeSegments } from '../data/routes';
import { PALETTE } from './basemap';

export interface RouteSplit {
  past: GeoJSON.FeatureCollection;
  active: GeoJSON.FeatureCollection;
  future: GeoJSON.FeatureCollection;
  /** 各部队当前行军头部位置（用于"当前位置"光点） */
  heads: { army: Army; coord: [number, number]; label: string }[];
}

/** 宽松日期解析：'1935-02' 视为当月 15 日，'1935-02-18' 精确 */
export function parseLooseDate(s: string): number {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 15);
}

const feature = (seg: RouteSegment, army: Army, coords: [number, number][], extra: Record<string, unknown> = {}) => ({
  type: 'Feature' as const,
  properties: {
    id: seg.id,
    armyId: seg.armyId,
    color: army.color,
    label: seg.label,
    from: seg.from,
    to: seg.to,
    ...extra,
  },
  geometry: { type: 'LineString' as const, coordinates: coords },
});

/** 在分段内部按途经点日期插值，截断出"截至当前日期"的路径 */
function truncate(seg: RouteSegment, now: number): { coords: [number, number][]; atEnd: boolean; head?: [number, number] } {
  const pts = seg.path;
  const full = pts.map((p) => p.coord);

  // 收集带日期的途经点索引
  const dated = pts
    .map((p, i) => ({ i, t: p.date ? parseLooseDate(p.date) : Number.NaN }))
    .filter((d) => !Number.isNaN(d.t));

  if (dated.length === 0) {
    // 没有日期信息：按分段区间线性插值
    const t0 = parseLooseDate(seg.from);
    const t1 = parseLooseDate(seg.to);
    const k = Math.max(0, Math.min(1, (now - t0) / (t1 - t0 || 1)));
    const idx = Math.min(full.length - 1, Math.floor(k * (full.length - 1)));
    const frac = k * (full.length - 1) - idx;
    const out = full.slice(0, idx + 1);
    if (idx + 1 < full.length) {
      const a = full[idx];
      const b = full[idx + 1];
      out.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
      return { coords: out, atEnd: false, head: out[out.length - 1] };
    }
    return { coords: out, atEnd: true, head: out[out.length - 1] };
  }

  // 第一段日期之前：全部未走
  if (now < dated[0].t) return { coords: [], atEnd: false };

  const out: [number, number][] = [];
  for (let i = 0; i < dated.length; i++) {
    const cur = dated[i];
    out.push(...full.slice(i === 0 ? 0 : dated[i - 1].i + 1, cur.i + 1));
    const next = dated[i + 1];
    if (!next || now < next.t) {
      if (!next) return { coords: out, atEnd: true, head: out[out.length - 1] };
      const k = (now - cur.t) / (next.t - cur.t);
      // 沿 cur.i → next.i 之间的折线按弧长插值
      const sub = full.slice(cur.i, next.i + 1);
      const partial = partialPolyline(sub, Math.max(0, Math.min(1, k)));
      out.push(...partial.slice(1));
      return { coords: out, atEnd: false, head: out[out.length - 1] };
    }
  }
  return { coords: out, atEnd: true, head: out[out.length - 1] };
}

function partialPolyline(pts: [number, number][], k: number): [number, number][] {
  if (pts.length < 2) return pts.slice();
  const segLen: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segLen.push(d);
    total += d;
  }
  const target = total * k;
  let acc = 0;
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = segLen[i - 1];
    if (acc + d >= target) {
      const t = d === 0 ? 0 : (target - acc) / d;
      const a = pts[i - 1];
      const b = pts[i];
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      return out;
    }
    acc += d;
    out.push(pts[i]);
  }
  return out;
}

export function splitRoutesAt(dateStr: string): RouteSplit {
  const now = parseLooseDate(dateStr);
  const past: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const active: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const future: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const heads: RouteSplit['heads'] = [];

  for (const seg of routeSegments) {
    const army = armies.find((a) => a.id === seg.armyId);
    if (!army) continue;
    const t0 = parseLooseDate(seg.from);
    const t1 = parseLooseDate(seg.to);

    if (now >= t1) {
      past.features.push(feature(seg, army, seg.path.map((p) => p.coord)));
    } else if (now < t0) {
      future.features.push(feature(seg, army, seg.path.map((p) => p.coord)));
    } else {
      const { coords, head } = truncate(seg, now);
      if (coords.length >= 2) active.features.push(feature(seg, army, coords));
      if (head) heads.push({ army, coord: head, label: seg.label });
    }
  }

  // 已结束的行军也给出终点作为"当前位置"
  for (const army of armies) {
    if (now >= parseLooseDate(army.endDate)) {
      const segs = routeSegments.filter((s) => s.armyId === army.id);
      const last = segs[segs.length - 1];
      const end = last.path[last.path.length - 1];
      heads.push({ army, coord: end.coord, label: `${army.short} 长征终点` });
    }
  }

  return { past, active, future, heads };
}

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function addRouteLayers(map: MlMap) {
  map.addSource('routes-future', { type: 'geojson', data: empty });
  map.addSource('routes-past', { type: 'geojson', data: empty });
  map.addSource('routes-active', { type: 'geojson', data: empty });
  map.addSource('routes-ghost', { type: 'geojson', data: empty });
  map.addSource('route-heads', { type: 'geojson', data: empty });

  map.addLayer({
    id: 'routes-future-line',
    type: 'line',
    source: 'routes-future',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.2, 8, 3.2],
      'line-opacity': ['coalesce', ['get', 'alpha'], 0.55],
      'line-dasharray': [2.6, 1.8],
    },
  });

  map.addLayer({
    id: 'routes-past-glow',
    type: 'line',
    source: 'routes-past',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 17],
      'line-opacity': ['*', 0.22, ['coalesce', ['get', 'alpha'], 1]],
      'line-blur': 4,
    },
  });

  map.addLayer({
    id: 'routes-past-line',
    type: 'line',
    source: 'routes-past',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.4, 8, 4.2],
      'line-opacity': ['coalesce', ['get', 'alpha'], 1],
    },
  });

  // 残影层：刚由「未到达」或「行进中」转为「已走过」的虚线在这里淡出，
  // 让虚线消失与实线出现之间有 600~800ms 的交叉过渡，而不是硬切。
  map.addLayer({
    id: 'routes-ghost-line',
    type: 'line',
    source: 'routes-ghost',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.2, 8, 3.4],
      'line-opacity': ['coalesce', ['get', 'alpha'], 0.5],
      'line-dasharray': [2.6, 1.8],
    },
  });

  map.addLayer({
    id: 'routes-active-line',
    type: 'line',
    source: 'routes-active',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.4, 8, 4.2],
      'line-opacity': 1,
      'line-dasharray': [2.6, 1.8],
    },
  });

  map.addLayer({
    id: 'route-heads-circle',
    type: 'circle',
    source: 'route-heads',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 8, 6],
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#0b0f14',
      'circle-opacity': 1,
    },
  });
}

// ---------------------------------------------------------------- 过渡状态机

type Phase = 'past' | 'active' | 'future';

/** 段从虚线转为实线的过渡时长（毫秒，真实时间，与时间轴速度无关） */
const FADE_MS = 760;
/** 刚转入 past 的段，记录真实时间起点 */
const freshPast = new Map<string, number>();
/** 虚线残影：刚离开 future / active 的段 */
interface Ghost {
  feature: GeoJSON.Feature;
  base: number;
  start: number;
}
const ghosts = new Map<string, Ghost>();
const phaseOf = new Map<string, Phase>();

let appliedMap: MlMap | null = null;
let appliedSplit: RouteSplit | null = null;
let animRaf = 0;

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

const keyOf = (f: GeoJSON.Feature) => String(f.properties?.id ?? '');

const withAlpha = (f: GeoJSON.Feature, alpha: number): GeoJSON.Feature => ({
  ...f,
  properties: { ...(f.properties ?? {}), alpha },
});

/** easeOutCubic：起步快、收尾慢，肉眼上更接近"慢慢显影"而不是线性变亮 */
const easeOut = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

/** 对比新旧阶段，登记需要过渡的段 */
function reconcile(split: RouteSplit, now: number) {
  const next = new Map<string, Phase>();
  for (const f of split.past.features) next.set(keyOf(f), 'past');
  for (const f of split.active.features) next.set(keyOf(f), 'active');
  for (const f of split.future.features) next.set(keyOf(f), 'future');

  const find = (coll: GeoJSON.FeatureCollection, id: string) =>
    coll.features.find((f) => keyOf(f) === id) ?? null;

  for (const [id, phase] of next) {
    const prev = phaseOf.get(id);
    if (!prev || prev === phase) continue;
    if (prev === 'future' && phase === 'active') {
      const src = find(split.active, id);
      if (src) ghosts.set(id, { feature: src, base: 0.5, start: now });
    } else if (prev === 'active' && phase === 'past') {
      const src = find(split.past, id);
      if (src) {
        ghosts.set(id, { feature: src, base: 0.8, start: now });
        freshPast.set(id, now);
      }
    }
  }

  phaseOf.clear();
  for (const [id, p] of next) phaseOf.set(id, p);

  // 时间轴回拖时清掉不再存在的过渡记录，避免下次进入同一段时错误地"半透明"
  for (const id of freshPast.keys()) if (phaseOf.get(id) !== 'past') freshPast.delete(id);
}

/** 按真实时间计算各层透明度并写入 source；返回是否还有未完成的过渡 */
function flush(map: MlMap, split: RouteSplit, now: number): boolean {
  let busy = false;

  const past = split.past.features.map((f) => {
    const t = freshPast.get(keyOf(f));
    if (t === undefined) return f;
    const k = easeOut((now - t) / FADE_MS);
    if (k >= 1) {
      freshPast.delete(keyOf(f));
      return f;
    }
    busy = true;
    return withAlpha(f, 0.3 + 0.7 * k);
  });

  const ghostFeatures: GeoJSON.Feature[] = [];
  for (const [id, g] of ghosts) {
    const k = easeOut((now - g.start) / FADE_MS);
    if (k >= 1) {
      ghosts.delete(id);
      continue;
    }
    busy = true;
    ghostFeatures.push(withAlpha(g.feature, g.base * (1 - k)));
  }

  (map.getSource('routes-future') as GeoJSONSource | undefined)?.setData(split.future);
  (map.getSource('routes-past') as GeoJSONSource | undefined)?.setData(fc(past));
  (map.getSource('routes-ghost') as GeoJSONSource | undefined)?.setData(fc(ghostFeatures));
  (map.getSource('routes-active') as GeoJSONSource | undefined)?.setData(split.active);

  const heads: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: split.heads.map((h) => ({
      type: 'Feature',
      properties: { color: h.army.color, armyId: h.army.id },
      geometry: { type: 'Point', coordinates: h.coord },
    })),
  };
  (map.getSource('route-heads') as GeoJSONSource | undefined)?.setData(heads);

  return busy;
}

/** 时间轴暂停时，过渡仍需按真实时间走完 */
function ensureAnim() {
  if (animRaf) return;
  const loop = () => {
    animRaf = 0;
    if (!appliedMap || !appliedSplit) return;
    if (flush(appliedMap, appliedSplit, performance.now())) animRaf = requestAnimationFrame(loop);
  };
  animRaf = requestAnimationFrame(loop);
}

export function updateRouteLayers(map: MlMap, split: RouteSplit) {
  const now = performance.now();
  appliedMap = map;
  appliedSplit = split;
  reconcile(split, now);
  if (flush(map, split, now)) ensureAnim();
}

/**
 * 行进段的呼吸光效。
 *
 * 早期版本每 90ms 在两种 dasharray 之间硬切做"虚线流动"，实测视觉上是闪烁而非流动
 * （maplibre 没有 dashoffset，dasharray 无法连续插值）。这里改为按帧连续变化透明度，
 * 保持虚线形态稳定，只让明暗平缓起伏。
 */
export function startRouteFlow(map: MlMap) {
  let raf = 0;
  const t0 = performance.now();
  const tick = (t: number) => {
    const s = 0.5 + 0.5 * Math.sin((t - t0) / 1200);
    if (map.getLayer('routes-active-line')) {
      map.setPaintProperty('routes-active-line', 'line-opacity', 0.82 + 0.18 * s);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export { PALETTE };
