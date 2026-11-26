/**
 * 敌我态势图层：把 Situation 里的标绘定义转成 GeoJSON，交给 maplibre 的 fill / line 图层渲染。
 *
 * 分工：
 *   - 面（箭头、集结地、防御阵地、阻击点）→ fill + line 描边
 *   - 线（行动轴线）→ line
 *   - 文字（部队番号、地名）→ DOM 标签，见 ui/situationPanel.ts
 */
import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import type { LonLat, PlotGraphic, Situation, SituationPhase } from '../data/types';
import { attackArrow, assembleArea, blockPoint, defenseLine, pincerArrows } from '../plot/plot';
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

export interface SituationGeometry {
  polygons: GeoJSON.FeatureCollection;
  lines: GeoJSON.FeatureCollection;
  labels: { coord: LonLat; text: string; side: 'red' | 'enemy' | 'neutral'; size?: number }[];
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

/** 把一帧态势的标绘全部转成几何。scale 用于把"真实千米量级"放大到屏幕可读的视觉效果 */
export function buildSituationGeometry(phase: SituationPhase, scale = 1): SituationGeometry {
  const polygons: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const lines: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const labels: SituationGeometry['labels'] = [];

  const sx = (style: { width: number; headWidth?: number; headLength?: number; tailTaper?: number }) => ({
    width: style.width * scale,
    headWidth: style.headWidth !== undefined ? style.headWidth * scale : undefined,
    headLength: style.headLength !== undefined ? style.headLength * scale : undefined,
    tailTaper: style.tailTaper,
  });

  for (const g of phase.graphics) {
    switch (g.kind) {
      case 'arrow': {
        const ring = attackArrow(g.path, sx(g.style));
        if (ring.length > 2) polygons.features.push(poly(ring, { side: g.side, gid: g.id }));
        break;
      }
      case 'pincer': {
        const rings = pincerArrows(g.start, g.end, { ...sx(g.style), spreadRatio: g.style.spreadRatio });
        rings.forEach((r, i) => {
          if (r.length > 2) polygons.features.push(poly(r, { side: g.side, gid: `${g.id}-${i}` }));
        });
        break;
      }
      case 'assemble': {
        const ring = assembleArea(g.center, g.radiusX * scale, g.radiusY * scale, g.rotation ?? 0);
        polygons.features.push(poly(ring, { side: g.side, gid: g.id, outlineOnly: true }));
        break;
      }
      case 'defense': {
        const ring = defenseLine(g.path, g.toothSize * scale, g.toothSide ?? 1);
        if (ring.length > 2) polygons.features.push(poly(ring, { side: g.side, gid: g.id }));
        break;
      }
      case 'block': {
        const ring = blockPoint(g.center, g.size * scale, g.rotation ?? 0);
        polygons.features.push(poly(ring, { side: g.side, gid: g.id }));
        break;
      }
      case 'markLine': {
        lines.features.push(line(g.path, { side: g.side, gid: g.id, dashed: g.dashed ?? true }));
        break;
      }
      case 'text': {
        labels.push({ coord: g.coord, text: g.text, side: g.side, size: g.size });
        break;
      }
      default:
        break;
    }

    // 图注文字
    if (g.kind !== 'text' && 'label' in g && g.label) {
      const anchor = labelAnchor(g);
      if (anchor) labels.push({ coord: anchor, text: g.label, side: g.side, size: 11 });
    }
  }

  return { polygons, lines, labels };
}

/** 为不同图形选一个合适的标签落点 */
function labelAnchor(g: PlotGraphic): LonLat | null {
  switch (g.kind) {
    case 'arrow': {
      if (g.labelAt) return g.labelAt;
      const mid = g.path[Math.floor(g.path.length / 2)];
      return mid ?? null;
    }
    case 'pincer': {
      return [(g.start[0] + g.end[0]) / 2, (g.start[1] + g.end[1]) / 2];
    }
    case 'assemble':
      return g.center;
    case 'defense': {
      return g.path[Math.floor(g.path.length / 2)] ?? null;
    }
    case 'block':
      return g.center;
    case 'markLine': {
      return g.path[Math.floor(g.path.length / 2)] ?? null;
    }
    default:
      return null;
  }
}

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function addSituationLayers(map: MlMap) {
  map.addSource('sit-polygons', { type: 'geojson', data: empty });
  map.addSource('sit-lines', { type: 'geojson', data: empty });
  map.addSource('sit-hydro', { type: 'geojson', data: empty });

  // 面填充
  map.addLayer({
    id: 'sit-fill',
    type: 'fill',
    source: 'sit-polygons',
    paint: {
      'fill-color': ['case', ['==', ['get', 'side'], 'red'], PALETTE.red, PALETTE.enemy],
      'fill-opacity': ['case', ['==', ['get', 'outlineOnly'], true], 0.07, 0.3],
    },
  });
  // 面描边
  map.addLayer({
    id: 'sit-outline',
    type: 'line',
    source: 'sit-polygons',
    paint: {
      'line-color': ['case', ['==', ['get', 'side'], 'red'], '#ff6b62', '#7fb6ec'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 10, 2.2],
      'line-opacity': 0.95,
      'line-dasharray': ['case', ['==', ['get', 'outlineOnly'], true], ['literal', [3, 2]], ['literal', [1, 0]]],
    },
  });
  // 水系
  map.addLayer({
    id: 'sit-hydro-line',
    type: 'line',
    source: 'sit-hydro',
    paint: {
      'line-color': PALETTE.waterHi,
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.6, 11, 3.4],
      'line-opacity': 0.95,
    },
  });
  // 行动轴线
  map.addLayer({
    id: 'sit-axis',
    type: 'line',
    source: 'sit-lines',
    paint: {
      'line-color': ['case', ['==', ['get', 'side'], 'red'], '#ff6b62', '#7fb6ec'],
      'line-width': 2,
      'line-dasharray': [4, 3],
      'line-opacity': 0.9,
    },
  });
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

/** 把整个态势所有阶段的标绘都算出来（供预缓存与包围盒计算） */
export function allPhaseGeometry(situation: Situation) {
  return situation.phases.map((p) => buildSituationGeometry(p));
}
