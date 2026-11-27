/**
 * 行军路线图层。
 *
 * 连续推进策略：
 * 1. 预先为每支部队的每个途经点分配单调递增的时间戳（首尾自动锚定分段起止时间，
 *    无日期中间点按折线弧长插值），消除「首点缺日期整段空白」与「尾段停滞」两类断口；
 * 2. 任一连续时刻 tsMs，直接在该部队当前行军位置 head 处将路线一分为二：
 *    - past   —— 起点 → head（连续生长的实线 + 微光晕）
 *    - lead   —— 紧贴 head 后方的一小段高亮前锋尾迹，强化推进方向感
 *    - future —— head → 终点（始终保留的未走淡虚线，不再整段突然消失）
 * 3. 支持大跨度跳转日期（如点击节点）时的平滑追赶过渡。
 */
import type { FilterSpecification, GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Army, LonLat, RouteSegment } from '../data/types';
import { armies } from '../data/armies';
import { routeSegments, segmentsByArmy } from '../data/routes';
import { PALETTE } from './basemap';

const DAY_MS = 86400000;

export interface RouteHead {
  army: Army;
  coord: LonLat;
  label: string;
  status: 'marching' | 'arrived';
}

export interface RouteSplit {
  past: GeoJSON.FeatureCollection;
  lead: GeoJSON.FeatureCollection;
  future: GeoJSON.FeatureCollection;
  /** 各部队当前行军头部位置（用于圆点与实时番号阶段挂签） */
  heads: RouteHead[];
}

export const ROUTE_LAYER_IDS = [
  'routes-future-line',
  'routes-past-glow',
  'routes-past-line',
  'routes-lead-glow',
  'routes-lead-line',
  'route-heads-halo',
  'route-heads-circle',
] as const;

/** 宽松日期解析：'1935-02' 视为当月 15 日，'1935-02-18' 精确到 UTC 0 点 */
export function parseLooseDate(s: string): number {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 15);
}

interface PreparedSegment {
  seg: RouteSegment;
  army: Army;
  coords: LonLat[];
  /** 与 coords 等长的单调不减时间戳（ms） */
  times: number[];
  /** 分段有效起始时间 */
  tStart: number;
  /** 分段有效结束时间（与下一段紧邻时无缝衔接到下一段起点） */
  tEnd: number;
}

const PREPARED: PreparedSegment[] = (() => {
  const out: PreparedSegment[] = [];
  for (const army of armies) {
    const segs = segmentsByArmy(army.id);
    for (let sIdx = 0; sIdx < segs.length; sIdx++) {
      const seg = segs[sIdx];
      const nextSeg = segs[sIdx + 1];
      const coords = seg.path.map((p) => p.coord);
      const n = coords.length;
      if (n < 2) continue;

      const rawFrom = parseLooseDate(seg.from);
      const rawTo = parseLooseDate(seg.to);
      const nextFrom = nextSeg ? parseLooseDate(nextSeg.from) : Number.NaN;
      const tStart = rawFrom;
      const tEnd =
        !Number.isNaN(nextFrom) && nextFrom >= rawTo && nextFrom - rawTo <= DAY_MS
          ? nextFrom
          : Math.max(rawFrom + DAY_MS * 0.5, rawTo);

      const anchors: { idx: number; t: number }[] = [{ idx: 0, t: tStart }];
      for (let i = 1; i < n - 1; i++) {
        const dStr = seg.path[i].date;
        const d = dStr ? parseLooseDate(dStr) : Number.NaN;
        if (!Number.isNaN(d)) {
          const prevT = anchors[anchors.length - 1].t;
          anchors.push({ idx: i, t: Math.max(prevT, Math.min(tEnd, d)) });
        }
      }

      const lastDateStr = seg.path[n - 1].date;
      const lastExplicit = lastDateStr ? parseLooseDate(lastDateStr) : Number.NaN;
      const prevT = anchors[anchors.length - 1].t;
      const hasGenuineHold = !Number.isNaN(lastExplicit) && rawTo - lastExplicit >= 2 * DAY_MS;
      const lastT = hasGenuineHold ? Math.max(prevT, Math.min(tEnd, lastExplicit)) : tEnd;
      anchors.push({ idx: n - 1, t: Math.max(prevT, lastT) });

      const times = new Array<number>(n).fill(tStart);
      for (let a = 0; a < anchors.length; a++) {
        times[anchors[a].idx] = anchors[a].t;
        if (a + 1 >= anchors.length) break;
        const i0 = anchors[a].idx;
        const i1 = anchors[a + 1].idx;
        const t0 = anchors[a].t;
        const t1 = anchors[a + 1].t;
        if (i1 <= i0 + 1) continue;

        const dists: number[] = [0];
        let sum = 0;
        for (let k = i0 + 1; k <= i1; k++) {
          sum += Math.hypot(coords[k][0] - coords[k - 1][0], coords[k][1] - coords[k - 1][1]);
          dists.push(sum);
        }
        for (let k = i0 + 1; k < i1; k++) {
          const ratio = sum > 0 ? dists[k - i0] / sum : (k - i0) / (i1 - i0);
          times[k] = t0 + (t1 - t0) * ratio;
        }
      }

      out.push({ seg, army, coords, times, tStart, tEnd });
    }
  }
  return out;
})();

const lineFeature = (
  id: string,
  army: Army,
  coords: LonLat[],
  extra: Record<string, unknown> = {},
): GeoJSON.Feature => ({
  type: 'Feature',
  properties: {
    id,
    armyId: army.id,
    color: army.color,
    ...extra,
  },
  geometry: { type: 'LineString', coordinates: coords },
});

/** 从已走路径末端截取固定地理弧长的前锋高亮尾迹（约 1.4° ≈ 140km） */
function extractLeadTrail(walked: LonLat[], maxDeg = 1.4): LonLat[] {
  if (walked.length < 2) return [];
  const rev: LonLat[] = [walked[walked.length - 1]];
  let acc = 0;
  for (let i = walked.length - 1; i >= 1; i--) {
    const a = walked[i];
    const b = walked[i - 1];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (acc + d >= maxDeg) {
      const t = d === 0 ? 0 : (maxDeg - acc) / d;
      rev.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      break;
    }
    acc += d;
    rev.push(b);
  }
  return rev.reverse();
}

/** 按连续时间戳或 ISO 日期切分四支主力的已走实线、前锋尾迹、未走虚线与当前位置头 */
export function splitRoutesAt(dateOrTs: string | number): RouteSplit {
  const now = typeof dateOrTs === 'number' ? dateOrTs : parseLooseDate(dateOrTs);
  const past: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const lead: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const future: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const heads: RouteHead[] = [];

  for (const army of armies) {
    const pSegs = PREPARED.filter((p) => p.army.id === army.id);
    if (pSegs.length === 0) continue;

    const armyWalked: LonLat[] = [];
    let activeHead: RouteHead | null = null;

    for (const p of pSegs) {
      const { seg, coords, times, tStart, tEnd } = p;
      const lastIdx = coords.length - 1;

      if (now <= times[0]) {
        future.features.push(lineFeature(seg.id, army, coords, { label: seg.label }));
      } else if (now >= times[lastIdx]) {
        past.features.push(lineFeature(seg.id, army, coords, { label: seg.label }));
        for (const c of coords) {
          const prev = armyWalked[armyWalked.length - 1];
          if (!prev || prev[0] !== c[0] || prev[1] !== c[1]) armyWalked.push(c);
        }
        if (now >= tStart && now < tEnd) {
          activeHead = { army, coord: coords[lastIdx], label: seg.label, status: 'marching' };
        }
      } else {
        // 精确落在 times[k] <= now < times[k+1]
        let k = 0;
        while (k + 1 < lastIdx && times[k + 1] <= now) k++;
        // 跳过零时长重合时间戳，定位到真正跨时间的区间
        while (k + 1 < lastIdx && times[k + 1] === times[k]) k++;
        const dt = times[k + 1] - times[k];
        const u = dt > 0 ? Math.max(0, Math.min(1, (now - times[k]) / dt)) : 1;
        const a = coords[k];
        const b = coords[k + 1];
        const headCoord: LonLat = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

        const walked = [...coords.slice(0, k + 1), headCoord];
        const ahead = [headCoord, ...coords.slice(k + 1)];

        if (walked.length >= 2) past.features.push(lineFeature(seg.id, army, walked, { label: seg.label }));
        if (ahead.length >= 2) future.features.push(lineFeature(`${seg.id}-rem`, army, ahead, { label: seg.label }));

        for (const c of walked) {
          const prev = armyWalked[armyWalked.length - 1];
          if (!prev || prev[0] !== c[0] || prev[1] !== c[1]) armyWalked.push(c);
        }
        activeHead = { army, coord: headCoord, label: seg.label, status: 'marching' };
      }
    }

    // 起始时刻（1934-10-10）给已处于出发点的红一方面军标出起点行军头
    const firstSeg = pSegs[0];
    const lastSeg = pSegs[pSegs.length - 1];
    if (!activeHead && Math.abs(now - firstSeg.tStart) < 1000) {
      activeHead = {
        army,
        coord: firstSeg.coords[0],
        label: firstSeg.seg.label,
        status: 'marching',
      };
    }

    if (activeHead) {
      heads.push(activeHead);
      const trail = extractLeadTrail(armyWalked, 1.4);
      if (trail.length >= 2) {
        lead.features.push(lineFeature(`${army.id}-lead`, army, trail));
      }
    } else if (now >= lastSeg.tEnd) {
      const endCoord = lastSeg.coords[lastSeg.coords.length - 1];
      heads.push({
        army,
        coord: endCoord,
        label: `胜利会师 · 抵达${army.endPlace.replace(/（.*）/, '')}`,
        status: 'arrived',
      });
    }
  }

  return { past, lead, future, heads };
}

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function addRouteLayers(map: MlMap) {
  map.addSource('routes-future', { type: 'geojson', data: empty });
  map.addSource('routes-past', { type: 'geojson', data: empty });
  map.addSource('routes-lead', { type: 'geojson', data: empty });
  map.addSource('route-heads', { type: 'geojson', data: empty });

  // 未走虚线：始终铺在最下层，行军实线推进时从上方自然覆盖，不会整段突然消失
  map.addLayer({
    id: 'routes-future-line',
    type: 'line',
    source: 'routes-future',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.9, 8, 3.0],
      'line-opacity': 0.44,
      'line-dasharray': [2.4, 2.0],
    },
  });

  // 已走实线光晕
  map.addLayer({
    id: 'routes-past-glow',
    type: 'line',
    source: 'routes-past',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 17],
      'line-opacity': 0.23,
      'line-blur': 4,
    },
  });

  // 已走实线主体
  map.addLayer({
    id: 'routes-past-line',
    type: 'line',
    source: 'routes-past',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.6, 8, 4.4],
      'line-opacity': 0.96,
    },
  });

  // 行军前锋高亮尾迹（紧随圆点后方 ~140km 的暖亮光带，增强连续推进感）
  map.addLayer({
    id: 'routes-lead-glow',
    type: 'line',
    source: 'routes-lead',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 12, 8, 22],
      'line-opacity': 0.34,
      'line-blur': 5,
    },
  });

  map.addLayer({
    id: 'routes-lead-line',
    type: 'line',
    source: 'routes-lead',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffd9d2',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.4, 8, 2.2],
      'line-opacity': 0.72,
    },
  });

  // 当前行军位置呼吸外环
  map.addLayer({
    id: 'route-heads-halo',
    type: 'circle',
    source: 'route-heads',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 7.5, 8, 13],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.28,
      'circle-blur': 0.45,
    },
  });

  // 当前行军位置实心圆点
  map.addLayer({
    id: 'route-heads-circle',
    type: 'circle',
    source: 'route-heads',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.8, 8, 6.2],
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#f8fafc',
      'circle-opacity': 1,
    },
  });
}

export function setRouteArmyFilter(map: MlMap, visibleArmyIds: string[]) {
  const expr = visibleArmyIds.length
    ? (['in', ['get', 'armyId'], ['literal', visibleArmyIds]] as unknown as FilterSpecification)
    : (['==', ['get', 'armyId'], '__none__'] as unknown as FilterSpecification);
  for (const lid of ROUTE_LAYER_IDS) {
    if (map.getLayer(lid)) map.setFilter(lid, expr);
  }
}

// ---------------------------------------------------------------- 平滑跳转控制器

let currentRenderedTs: number | null = null;
let tweenRaf = 0;
let onHeadsCallback: ((heads: RouteHead[]) => void) | null = null;

export function onRouteHeadsChange(cb: (heads: RouteHead[]) => void) {
  onHeadsCallback = cb;
}

function writeSplitToMap(map: MlMap, split: RouteSplit) {
  (map.getSource('routes-future') as GeoJSONSource | undefined)?.setData(split.future);
  (map.getSource('routes-past') as GeoJSONSource | undefined)?.setData(split.past);
  (map.getSource('routes-lead') as GeoJSONSource | undefined)?.setData(split.lead);

  const headsGeo: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: split.heads.map((h) => ({
      type: 'Feature',
      properties: { color: h.army.color, armyId: h.army.id, status: h.status },
      geometry: { type: 'Point', coordinates: h.coord },
    })),
  };
  (map.getSource('route-heads') as GeoJSONSource | undefined)?.setData(headsGeo);
  onHeadsCallback?.(split.heads);
}

/**
 * 更新路线图层。
 * - 正常播放或拖动滑块时（animate = false）：按连续毫秒时间戳 60fps 实时切分；
 * - 点击节点跳转大跨度日期时（animate = true）：用 320ms 缓动让实线顺着轨迹追赶过去。
 */
export function updateRouteLayers(map: MlMap, splitOrTs: RouteSplit | number, animate = false) {
  if (typeof splitOrTs !== 'number') {
    cancelAnimationFrame(tweenRaf);
    tweenRaf = 0;
    writeSplitToMap(map, splitOrTs);
    return;
  }

  const targetTs = splitOrTs;
  cancelAnimationFrame(tweenRaf);
  tweenRaf = 0;

  if (!animate || currentRenderedTs === null || Math.abs(targetTs - currentRenderedTs) < 2 * DAY_MS) {
    currentRenderedTs = targetTs;
    writeSplitToMap(map, splitRoutesAt(targetTs));
    return;
  }

  const fromTs = currentRenderedTs;
  const t0 = performance.now();
  const duration = 320;
  const step = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - t0) / duration));
    const eased = 1 - Math.pow(1 - k, 3);
    currentRenderedTs = fromTs + (targetTs - fromTs) * eased;
    writeSplitToMap(map, splitRoutesAt(currentRenderedTs));
    if (k < 1) {
      tweenRaf = requestAnimationFrame(step);
    } else {
      tweenRaf = 0;
    }
  };
  tweenRaf = requestAnimationFrame(step);
}

/** 行军头光晕与前锋尾迹的柔和呼吸动效 */
export function startRouteFlow(map: MlMap) {
  let raf = 0;
  const t0 = performance.now();
  const tick = (t: number) => {
    const s = 0.5 + 0.5 * Math.sin((t - t0) / 700);
    if (map.getLayer('route-heads-halo')) {
      map.setPaintProperty('route-heads-halo', 'circle-opacity', 0.18 + 0.24 * s);
    }
    if (map.getLayer('routes-lead-glow')) {
      map.setPaintProperty('routes-lead-glow', 'line-opacity', 0.24 + 0.18 * s);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export { routeSegments, PALETTE };
