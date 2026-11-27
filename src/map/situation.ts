/**
 * 敌我态势图层：输出燕尾倒钩箭头、中轴高光脊线、细轨刺齿防线、水系与法向避让标签锚点。
 */
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { LonLat, PlotGraphic, Situation, SituationPhase } from '../data/types';
import { chaikin, fromLL, toLL } from '../plot/geo';
import {
  assembleArea,
  attackArrowDetailed,
  blockPoint,
  defenseLine,
  pincerArrowsDetailed,
  pointAlongLL,
  sliceLineLL,
} from '../plot/plot';

export interface SideStyle {
  fill: string;
  line: string;
  glow: string;
  label: string;
}

export const SIDE_STYLE: Record<'red' | 'enemy', SideStyle> = {
  red: { fill: 'rgba(224,68,62,0.24)', line: '#ff786f', glow: 'rgba(224,68,62,0.45)', label: '#ffd7d3' },
  enemy: { fill: 'rgba(75,134,198,0.22)', line: '#86bcf0', glow: 'rgba(75,134,198,0.42)', label: '#d3e6ff' },
};

export interface SituationClashPoint {
  id: string;
  coord: LonLat;
  side: 'red' | 'enemy';
  label?: string;
  alpha: number;
}

export interface SituationLabelSpec {
  id: string;
  coord: LonLat;
  /** 供屏幕空间仲裁器沿图形法向向两侧偏置的切线方向参考点 */
  tangentTo?: LonLat;
  text: string;
  side: 'red' | 'enemy' | 'neutral';
  size?: number;
  alpha?: number;
}

export interface SituationGeometry {
  polygons: GeoJSON.FeatureCollection;
  spines: GeoJSON.FeatureCollection;
  lines: GeoJSON.FeatureCollection;
  labels: SituationLabelSpec[];
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

export function buildSituationGeometry(
  phase: SituationPhase,
  scale = 1,
  phaseProgress = 1,
): SituationGeometry {
  const polygons: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const spines: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const lines: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const labels: SituationLabelSpec[] = [];
  const clashes: SituationClashPoint[] = [];

  const sx = (style: {
    width: number;
    headWidth?: number;
    headLength?: number;
    tailTaper?: number;
    arcRatio?: number;
  }) => ({
    width: style.width * scale,
    headWidth: style.headWidth !== undefined ? style.headWidth * scale : undefined,
    headLength: style.headLength !== undefined ? style.headLength * scale : undefined,
    tailTaper: style.tailTaper,
    arcRatio: style.arcRatio,
  });

  for (const g of phase.graphics) {
    const [a0, a1] = defaultAnimWindow(g);
    const rawP = phaseProgress >= 0.999 ? 1 : (phaseProgress - a0) / Math.max(0.05, a1 - a0);
    if (rawP <= 0.01) continue;
    const gp = easeOutCubic(rawP);
    const alpha = Math.min(1, rawP * 2.2);

    switch (g.kind) {
      case 'arrow': {
        const res = attackArrowDetailed(g.path, sx(g.style), gp);
        if (res.ring.length > 2) {
          polygons.features.push(poly(res.ring, { side: g.side, gid: g.id, kind: 'arrow', alpha }));
        }
        if (res.spine.length >= 2) {
          spines.features.push(line(res.spine, { side: g.side, gid: `${g.id}-sp`, alpha }));
        }
        break;
      }
      case 'pincer': {
        const results = pincerArrowsDetailed(
          g.start,
          g.end,
          { ...sx(g.style), spreadRatio: g.style.spreadRatio },
          gp,
        );
        results.forEach((res, i) => {
          if (res.ring.length > 2) {
            polygons.features.push(poly(res.ring, { side: g.side, gid: `${g.id}-${i}`, kind: 'pincer', alpha }));
          }
          if (res.spine.length >= 2) {
            spines.features.push(line(res.spine, { side: g.side, gid: `${g.id}-sp-${i}`, alpha }));
          }
        });
        break;
      }
      case 'assemble': {
        const ring = assembleArea(g.center, g.radiusX * scale, g.radiusY * scale, g.rotation ?? 0, 48, gp);
        if (ring.length > 2) {
          polygons.features.push(poly(ring, { side: g.side, gid: g.id, kind: 'assemble', outlineOnly: true, alpha }));
        }
        break;
      }
      case 'defense': {
        const ring = defenseLine(g.path, g.toothSize * scale, g.toothSide ?? 1, gp);
        if (ring.length > 2) {
          polygons.features.push(poly(ring, { side: g.side, gid: g.id, kind: 'defense', isDefense: true, alpha }));
        }
        break;
      }
      case 'block': {
        const ring = blockPoint(g.center, g.size * scale, g.rotation ?? 0, gp);
        if (ring.length > 2) {
          polygons.features.push(poly(ring, { side: g.side, gid: g.id, kind: 'block', isDefense: true, alpha }));
        }
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
        labels.push({ id: g.id, coord: g.coord, text: g.text, side: g.side, size: g.size, alpha });
        break;
      }
      case 'clash': {
        clashes.push({ id: g.id, coord: g.coord, side: g.side, label: g.label, alpha });
        break;
      }
      default:
        break;
    }

    if (g.kind !== 'text' && g.kind !== 'clash' && 'label' in g && g.label && gp >= 0.32) {
      const anchorInfo = labelAnchorWithTangent(g, gp);
      const labelAlpha = Math.min(1, (gp - 0.32) / 0.42);
      if (anchorInfo) {
        labels.push({
          id: `${g.id}-lbl`,
          coord: anchorInfo.coord,
          tangentTo: anchorInfo.tangentTo,
          text: g.label,
          side: g.side,
          size: 11,
          alpha: labelAlpha,
        });
      }
    }
  }

  return { polygons, spines, lines, labels, clashes };
}

function labelAnchorWithTangent(
  g: PlotGraphic,
  progress = 1,
): { coord: LonLat; tangentTo?: LonLat } | null {
  switch (g.kind) {
    case 'arrow': {
      if (g.labelAt && progress > 0.7) return { coord: g.labelAt };
      const r0 = 0.46 * progress;
      const r1 = Math.min(1, r0 + 0.14);
      const p0 = pointAlongLL(g.path, r0);
      const p1 = pointAlongLL(g.path, r1) ?? undefined;
      return p0 ? { coord: p0, tangentTo: p1 } : null;
    }
    case 'pincer': {
      const k = 0.45 * progress;
      const coord: LonLat = [
        g.start[0] + (g.end[0] - g.start[0]) * k,
        g.start[1] + (g.end[1] - g.start[1]) * k,
      ];
      return { coord, tangentTo: g.end };
    }
    case 'assemble':
      return { coord: g.center };
    case 'defense': {
      const p0 = pointAlongLL(g.path, 0.5 * progress);
      const p1 = pointAlongLL(g.path, Math.min(1, 0.5 * progress + 0.15)) ?? undefined;
      return p0 ? { coord: p0, tangentTo: p1 } : null;
    }
    case 'block':
      return { coord: g.center };
    case 'markLine': {
      const p0 = pointAlongLL(g.path, 0.22 * progress);
      const p1 = pointAlongLL(g.path, Math.min(1, 0.22 * progress + 0.12)) ?? undefined;
      return p0 ? { coord: p0, tangentTo: p1 } : null;
    }
    default:
      return null;
  }
}

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function addSituationLayers(map: MlMap) {
  map.addSource('sit-polygons', { type: 'geojson', data: empty });
  map.addSource('sit-spines', { type: 'geojson', data: empty });
  map.addSource('sit-lines', { type: 'geojson', data: empty });
  map.addSource('sit-hydro', { type: 'geojson', data: empty });
  map.addSource('sit-geo-zones', { type: 'geojson', data: empty });

  const beforeRoute = map.getLayer('routes-past-glow') ? 'routes-past-glow' : undefined;

  // 0. 场景特殊地理面域（如松潘草地高原沼泽带）与山脊走向虚线
  map.addLayer(
    {
      id: 'sit-geo-zone-fill',
      type: 'fill',
      source: 'sit-geo-zones',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': '#3f8f82',
        'fill-opacity': 0.16,
      },
    },
    beforeRoute,
  );

  map.addLayer(
    {
      id: 'sit-geo-zone-line',
      type: 'line',
      source: 'sit-geo-zones',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'kind'], 'ridge'],
          'rgba(218, 198, 170, 0.42)',
          'rgba(104, 196, 178, 0.48)',
        ],
        'line-width': ['case', ['==', ['get', 'kind'], 'ridge'], 2.2, 1.4],
        'line-dasharray': [2.4, 2.2],
      },
    },
    beforeRoute,
  );

  // 1. 战役水系双层发光渲染（主河道如赤水河、湘江、金沙江、大渡河采用高对比青碧发光带，一眼可辨）
  map.addLayer(
    {
      id: 'sit-hydro-glow',
      type: 'line',
      source: 'sit-hydro',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'primary'], true], '#36d6f5', '#2a8eb0'],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5.5,
          ['case', ['==', ['get', 'primary'], true], 8, 5],
          10.5,
          ['case', ['==', ['get', 'primary'], true], 16, 10],
        ],
        'line-blur': 4,
        'line-opacity': ['case', ['==', ['get', 'primary'], true], 0.36, 0.2],
      },
    },
    beforeRoute,
  );

  map.addLayer(
    {
      id: 'sit-hydro-line',
      type: 'line',
      source: 'sit-hydro',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'primary'], true], '#6ee7ff', '#46acc9'],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5.5,
          ['case', ['==', ['get', 'primary'], true], 2.4, 1.6],
          10.5,
          ['case', ['==', ['get', 'primary'], true], 4.2, 2.8],
        ],
        'line-opacity': ['case', ['==', ['get', 'primary'], true], 0.96, 0.82],
      },
    },
    beforeRoute,
  );

  // 2. 态势箭头外层柔和光晕（提升沙盘立体层次感）
  map.addLayer(
    {
      id: 'sit-glow',
      type: 'line',
      source: 'sit-polygons',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'side'], 'red'], '#e0443e', '#4b86c6'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 5, 10, 11],
        'line-blur': 4,
        'line-opacity': ['*', 0.24, ['coalesce', ['get', 'alpha'], 1]],
      },
    },
    beforeRoute,
  );

  // 3. 态势多边形主体填充（箭头半透明清透，细轨刺齿防线高实度锐利）
  map.addLayer(
    {
      id: 'sit-fill',
      type: 'fill',
      source: 'sit-polygons',
      paint: {
        'fill-color': ['case', ['==', ['get', 'side'], 'red'], '#e64c45', '#5592d4'],
        'fill-opacity': [
          '*',
          ['coalesce', ['get', 'alpha'], 1],
          [
            'case',
            ['==', ['get', 'outlineOnly'], true],
            0.06,
            ['==', ['get', 'isDefense'], true],
            0.68,
            0.22,
          ],
        ],
      },
    },
    beforeRoute,
  );

  // 4. 箭身内部中轴高光脊线（军史地图级精致矢量质感）
  map.addLayer(
    {
      id: 'sit-spine',
      type: 'line',
      source: 'sit-spines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'side'], 'red'], '#ffb8b0', '#b8dcff'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 0.9, 10, 1.5],
        'line-opacity': ['*', 0.58, ['coalesce', ['get', 'alpha'], 1]],
      },
    },
    beforeRoute,
  );

  // 5. 锐利矢量轮廓线
  map.addLayer(
    {
      id: 'sit-outline',
      type: 'line',
      source: 'sit-polygons',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'side'], 'red'], '#ff7d73', '#8cc2f6'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 1.15, 10, 1.85],
        'line-opacity': ['*', 0.92, ['coalesce', ['get', 'alpha'], 1]],
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

  // 6. 合围圈虚线
  map.addLayer(
    {
      id: 'sit-axis',
      type: 'line',
      source: 'sit-lines',
      paint: {
        'line-color': ['case', ['==', ['get', 'side'], 'red'], '#ff7d73', '#8cc2f6'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5.5, 1.3, 10, 2.0],
        'line-dasharray': [3.6, 2.8],
        'line-opacity': ['*', 0.72, ['coalesce', ['get', 'alpha'], 1]],
      },
    },
    beforeRoute,
  );
}

export function updateSituationLayers(
  map: MlMap,
  geo: SituationGeometry,
  hydro?: GeoJSON.FeatureCollection,
  geoZones?: GeoJSON.FeatureCollection,
) {
  (map.getSource('sit-polygons') as GeoJSONSource | undefined)?.setData(geo.polygons);
  (map.getSource('sit-spines') as GeoJSONSource | undefined)?.setData(geo.spines);
  (map.getSource('sit-lines') as GeoJSONSource | undefined)?.setData(geo.lines);
  if (hydro) (map.getSource('sit-hydro') as GeoJSONSource | undefined)?.setData(hydro);
  if (geoZones) (map.getSource('sit-geo-zones') as GeoJSONSource | undefined)?.setData(geoZones);
}

export function clearSituationLayers(map: MlMap) {
  (map.getSource('sit-polygons') as GeoJSONSource | undefined)?.setData(empty);
  (map.getSource('sit-spines') as GeoJSONSource | undefined)?.setData(empty);
  (map.getSource('sit-lines') as GeoJSONSource | undefined)?.setData(empty);
  (map.getSource('sit-hydro') as GeoJSONSource | undefined)?.setData(empty);
  (map.getSource('sit-geo-zones') as GeoJSONSource | undefined)?.setData(empty);
}

export function hydroGeoJSON(
  rivers: Record<string, [number, number][]>,
  primaryKeys: string[] = [],
): GeoJSON.FeatureCollection {
  const pSet = new Set(primaryKeys);
  return {
    type: 'FeatureCollection',
    features: Object.entries(rivers).map(([name, coords]) => {
      const smooth = coords.length >= 3 ? toLL(chaikin(fromLL(coords), 2)) : coords;
      return line(smooth, { name, primary: pSet.size === 0 || pSet.has(name) });
    }),
  };
}

export function geoZoneFeatures(
  zones: { id: string; kind: 'marsh' | 'ridge'; coords: LonLat[] }[] = [],
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => {
      if (z.kind === 'marsh') {
        const smooth = z.coords.length >= 3 ? toLL(chaikin(fromLL(z.coords), 2)) : z.coords;
        return poly(smooth, { id: z.id, kind: 'marsh' });
      }
      const smooth = z.coords.length >= 3 ? toLL(chaikin(fromLL(z.coords), 2)) : z.coords;
      return line(smooth, { id: z.id, kind: 'ridge' });
    }),
  };
}

export function allPhaseGeometry(situation: Situation) {
  return situation.phases.map((p) => buildSituationGeometry(p, situation.plotScale ?? 1, 1));
}
