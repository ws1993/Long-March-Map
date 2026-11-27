/**
 * 敌我态势图层：把态势标绘定义按阶段内动画进度 `phaseProgress ∈ [0, 1]` 实时生成为 GeoJSON + 标签 + 激战脉冲点。
 *
 * 图层叠放关系：
 *   - 战役水系底纹（sit-hydro-line）与敌我态势面/描边置于红军已走实线之下或半透明交叠，
 *     保证「长征主路线全程不断且居视觉主轴」，同时清晰呈现围追堵截与穿插破局动作。
 */
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { LonLat, PlotGraphic, Situation, SituationPhase } from '../data/types';
import {
  assembleArea,
  attackArrow,
  blockPoint,
  defenseLine,
  pincerArrows,
  pointAlongLL,
  sliceLineLL,
} from '../plot/plot';
import { PALETTE } from './basemap';

export interface SideStyle {
  fill: string;
  line: string;
  glow: string;
  label: string;
}

export const SIDE_STYLE: Record<'red' | 'enemy', SideStyle> = {
  red: { fill: 'rgba(224,68,62,0.30)', line: '#f0574f', glow: 'rgba(224,68,62,0.55)', label: '#ffd7d3' },
  enemy: { fill: 'rgba(75,134,198,0.26)', line: '#6ea6de', glow: 'rgba(75,134,198,0.5)', label: '#d3e6ff' },
};

export interface SituationClashPoint {
  id: string;
  coord: LonLat;
  side: 'red' | 'enemy';
  label?: string;
  alpha: number;
}

export interface SituationGeometry {
  polygons: GeoJSON.FeatureCollection;
  lines: GeoJSON.FeatureCollection;
  labels: { coord: LonLat; text: string; side: 'red' | 'enemy' | 'neutral'; size?: number; alpha?: number }[];
  clashes: SituationClashPoint[];
}

const poly = (ring: LonLat[], props: Record<string, unknown>): GeoJSON.Feature => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'Polygon', coordinates: [closeRing(ring)] },
});

const line = (coords: LonLat[], props: Record<string, unknown>): GeoJSON.Feature => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'LineString', coordinates: coords },
});

function closeRing(ring: LonLat[]): LonLat[] {
  if (ring.length === 0) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) return [...ring, a];
  return ring;
}

/** 按图形种类与阵营分配默认交错出场时间窗，让敌方先构筑合围、红军随即穿插破局 */
function defaultAnimWindow(g: PlotGraphic): [number, number] {
  if (g.anim) return g.anim;
  switch (g.kind) {
    case 'defense':
    case 'markLine':
      return g.side === 'enemy' ? [0.0, 0.42] : [0.12, 0.52];
    case 'assemble':
      return [0.0, 0.35];
    case 'arrow':
    case 'pincer':
      return g.side === 'enemy' ? [0.06, 0.58] : [0.22, 0.78];
    case 'block':
    case 'clash':
      return [0.28, 0.65];
    case 'text':
      return [0.35, 0.72];
    default:
      return [0, 0.6];
  }
}

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

/** 把一帧态势的标绘按 phaseProgress ∈ [0, 1] 转成动态几何 */
export function buildSituationGeometry(
  phase: SituationPhase,
  scale = 1,
  phaseProgress = 1,
): SituationGeometry {
  const polygons: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const lines: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const labels: SituationGeometry['labels'] = [];
  const clashes: SituationClashPoint[] = [];

  const sx = (style: { width: number; headWidth?: number; headLength?: number; tailTaper?: number }) => ({
    width: style.width * scale,
    headWidth: style.headWidth !== undefined ? style.headWidth * scale : undefined,
    headLength: style.headLength !== undefined ? style.headLength * scale : undefined,
    tailTaper: style.tailTaper,
  });

  for (const g of phase.graphics) {
    const [a0, a1] = defaultAnimWindow(g);
    const rawP = phaseProgress >= 0.999 ? 1 : (phaseProgress - a0) / Math.max(0.05, a1 - a0);
    if (rawP <= 0.01) continue;
    const gp = easeOutCubic(rawP);
    const alpha = Math.min(1, rawP * 2.2);

    switch (g.kind) {
      case 'arrow': {
        const ring = attackArrow(g.path, sx(g.style), gp);
        if (ring.length > 2) polygons.features.push(poly(ring, { side: g.side, gid: g.id, alpha }));
        break;
      }
      case 'pincer': {
        const rings = pincerArrows(g.start, g.end, { ...sx(g.style), spreadRatio: g.style.spreadRatio }, gp);
        rings.forEach((r, i) => {
          if (r.length > 2) polygons.features.push(poly(r, { side: g.side, gid: `${g.id}-${i}`, alpha }));
        });
        break;
      }
      case 'assemble': {
        const ring = assembleArea(g.center, g.radiusX * scale, g.radiusY * scale, g.rotation ?? 0, 48, gp);
        if (ring.length > 2) {
          polygons.features.push(poly(ring, { side: g.side, gid: g.id, outlineOnly: true, alpha }));
        }
        break;
      }
      case 'defense': {
        const ring = defenseLine(g.path, g.toothSize * scale, g.toothSide ?? 1, gp);
        if (ring.length > 2) polygons.features.push(poly(ring, { side: g.side, gid: g.id, alpha }));
        break;
      }
      case 'block': {
        const ring = blockPoint(g.center, g.size * scale, g.rotation ?? 0, gp);
        if (ring.length > 2) polygons.features.push(poly(ring, { side: g.side, gid: g.id, alpha }));
        break;
      }
      case 'markLine': {
        const sliced = sliceLineLL(g.path, gp);
        if (sliced.length >= 2) {
          lines.features.push(line(sliced, { side: g.side, gid: g.id, dashed: g.dashed ?? true, alpha }));
        }
        break;
      }
      case 'text': {
        labels.push({ coord: g.coord, text: g.text, side: g.side, size: g.size, alpha });
        break;
      }
      case 'clash': {
        clashes.push({ id: g.id, coord: g.coord, side: g.side, label: g.label, alpha });
        break;
      }
      default:
        break;
    }

    if (g.kind !== 'text' && g.kind !== 'clash' && 'label' in g && g.label && gp >= 0.25) {
      const anchor = labelAnchor(g, gp);
      const labelAlpha = Math.min(1, (gp - 0.25) / 0.45);
      if (anchor) labels.push({ coord: anchor, text: g.label, side: g.side, size: 11, alpha: labelAlpha });
    }
  }

  return { polygons, lines, labels, clashes };
}

function labelAnchor(g: PlotGraphic, progress = 1): LonLat | null {
  switch (g.kind) {
    case 'arrow': {
      if (g.labelAt && progress > 0.7) return g.labelAt;
      return pointAlongLL(g.path, 0.52 * progress);
    }
    case 'pincer': {
      const k = 0.5 * progress;
      return [g.start[0] + (g.end[0] - g.start[0]) * k, g.start[1] + (g.end[1] - g.start[1]) * k];
    }
    case 'assemble':
      return g.center;
    case 'defense':
      return pointAlongLL(g.path, 0.5 * progress);
    case 'block':
      return g.center;
    case 'markLine':
      return pointAlongLL(g.path, 0.45 * progress);
    default:
      return null;
  }
}

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function addSituationLayers(map: MlMap) {
  map.addSource('sit-polygons', { type: 'geojson', data: empty });
  map.addSource('sit-lines', { type: 'geojson', data: empty });
  map.addSource('sit-hydro', { type: 'geojson', data: empty });

  // 放在 routes-past-glow 之前，使红军主线实线始终清晰浮在战役态势填充之上
  const beforeRoute = map.getLayer('routes-past-glow') ? 'routes-past-glow' : undefined;

  // 水系高亮底纹
  map.addLayer(
    {
      id: 'sit-hydro-line',
      type: 'line',
      source: 'sit-hydro',
      paint: {
        'line-color': PALETTE.waterHi,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 1.5, 10.5, 3.4],
        'line-opacity': 0.92,
      },
    },
    beforeRoute,
  );

  // 面填充
  map.addLayer(
    {
      id: 'sit-fill',
      type: 'fill',
      source: 'sit-polygons',
      paint: {
        'fill-color': ['case', ['==', ['get', 'side'], 'red'], PALETTE.red, PALETTE.enemy],
        'fill-opacity': [
          '*',
          ['coalesce', ['get', 'alpha'], 1],
          ['case', ['==', ['get', 'outlineOnly'], true], 0.08, 0.28],
        ],
      },
    },
    beforeRoute,
  );

  // 面描边
  map.addLayer(
    {
      id: 'sit-outline',
      type: 'line',
      source: 'sit-polygons',
      paint: {
        'line-color': ['case', ['==', ['get', 'side'], 'red'], '#ff6b62', '#7fb6ec'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 1.2, 10, 2.2],
        'line-opacity': ['*', 0.95, ['coalesce', ['get', 'alpha'], 1]],
        'line-dasharray': [
          'case',
          ['==', ['get', 'outlineOnly'], true],
          ['literal', [3, 2]],
          ['literal', [1, 0]],
        ],
      },
    },
    beforeRoute,
  );

  // 行动轴线 / 合围圈虚线
  map.addLayer(
    {
      id: 'sit-axis',
      type: 'line',
      source: 'sit-lines',
      paint: {
        'line-color': ['case', ['==', ['get', 'side'], 'red'], '#ff6b62', '#7fb6ec'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 1.6, 10, 2.4],
        'line-dasharray': [4, 2.8],
        'line-opacity': ['*', 0.88, ['coalesce', ['get', 'alpha'], 1]],
      },
    },
    beforeRoute,
  );
}

export function updateSituationLayers(map: MlMap, geo: SituationGeometry, hydro?: GeoJSON.FeatureCollection) {
  (map.getSource('sit-polygons') as GeoJSONSource | undefined)?.setData(geo.polygons);
  (map.getSource('sit-lines') as GeoJSONSource | undefined)?.setData(geo.lines);
  if (hydro) (map.getSource('sit-hydro') as GeoJSONSource | undefined)?.setData(hydro);
}

export function clearSituationLayers(map: MlMap) {
  (map.getSource('sit-polygons') as GeoJSONSource | undefined)?.setData(empty);
  (map.getSource('sit-lines') as GeoJSONSource | undefined)?.setData(empty);
  (map.getSource('sit-hydro') as GeoJSONSource | undefined)?.setData(empty);
}

export function hydroGeoJSON(rivers: Record<string, [number, number][]>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Object.entries(rivers).map(([name, coords]) => line(coords, { name })),
  };
}

export function allPhaseGeometry(situation: Situation) {
  return situation.phases.map((p) => buildSituationGeometry(p, situation.plotScale ?? 1, 1));
}
