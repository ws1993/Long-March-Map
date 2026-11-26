/**
 * 底图样式构建。
 *
 * 设计要点：
 * - 完全离线：地形来自本地预烘的 hillshade PNG（image source），
 *   省界/河流来自本地 GeoJSON，不依赖任何瓦片服务，也不依赖 glyph 字体（文字全部用 DOM Marker 渲染）。
 * - 深色沙盘基调：低饱和地形 + 冷色水系 + 克制的省界，把视觉重心留给红色的长征路线。
 * - 两级地形：整幅走廊用 z=7 的「总览底图」；进入某场战役时，叠加该战场 z=10 的
 *   「战场底图」（更清晰的山脊与河谷），让态势标绘有地形依托。
 */
import type { StyleSpecification } from 'maplibre-gl';

export const PALETTE = {
  bg: '#080b10',
  /** 省界 */
  border: '#2b3947',
  borderHi: '#3d5062',
  /** 河流 */
  water: '#1e4d61',
  waterHi: '#2b6d85',
  /** 红军主色 */
  red: '#e0443e',
  /** 敌军主色 */
  enemy: '#4b86c6',
  /** 文本 */
  ink: '#e8eef5',
  inkDim: '#8fa3b8',
};

export interface TerrainMeta {
  file: string;
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
}

const corners = (t: TerrainMeta): [[number, number], [number, number], [number, number], [number, number]] => [
  [t.west, t.north],
  [t.east, t.north],
  [t.east, t.south],
  [t.west, t.south],
];

export async function loadTerrainMeta(): Promise<TerrainMeta> {
  const res = await fetch(`${import.meta.env.BASE_URL}geo/terrain-bounds.json`);
  if (!res.ok) throw new Error('地形元数据缺失，请先运行 node scripts/bake-terrain.mjs');
  return (await res.json()) as TerrainMeta;
}

/** 战场级底图是可选的：某场战役没烘就跳过，不阻塞启动 */
export async function loadDetailTerrains(names: string[]): Promise<Record<string, TerrainMeta>> {
  const out: Record<string, TerrainMeta> = {};
  await Promise.all(
    names.map(async (name) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}geo/terrain-bounds-${name}.json`);
        if (res.ok) out[name] = (await res.json()) as TerrainMeta;
      } catch {
        /* 可选资源，缺失就跳过 */
      }
    }),
  );
  return out;
}

export function buildBaseStyle(terrain: TerrainMeta, details: Record<string, TerrainMeta> = {}): StyleSpecification {
  const base = import.meta.env.BASE_URL;

  const detailSources = Object.fromEntries(
    Object.entries(details).map(([name, meta]) => [
      `detail-${name}`,
      { type: 'image' as const, url: `${base}geo/${meta.file}`, coordinates: corners(meta) },
    ]),
  );

  const detailLayers = Object.keys(details).map((name) => ({
    id: `detail-${name}-layer`,
    type: 'raster' as const,
    source: `detail-${name}`,
    layout: { visibility: 'none' as const },
    paint: {
      'raster-opacity': 1,
      'raster-resampling': 'linear' as const,
      'raster-fade-duration': 0,
      'raster-brightness-min': 0.1,
      'raster-brightness-max': 1,
      'raster-contrast': 0.32,
      'raster-saturation': 0.22,
    },
  }));

  return {
    version: 8,
    name: 'long-march-dark-sandbox',
    // 不使用 glyph：所有文字由 DOM Marker 呈现，保证无字体服务也能完整显示中文
    sources: {
      terrain: {
        type: 'image',
        url: `${base}geo/${terrain.file}`,
        coordinates: corners(terrain),
      },
      ...detailSources,
      provinces: { type: 'geojson', data: `${base}geo/china-provinces.json` },
      rivers: { type: 'geojson', data: `${base}geo/china-rivers.json` },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': PALETTE.bg } },
      {
        id: 'terrain',
        type: 'raster',
        source: 'terrain',
        paint: {
          'raster-opacity': 0.95,
          'raster-resampling': 'linear',
          'raster-fade-duration': 0,
          'raster-brightness-min': 0.09,
          'raster-brightness-max': 1,
          'raster-contrast': 0.14,
          'raster-saturation': 0.15,
        },
      },
      // 压在底图上的冷色薄雾，把地形推远、把前景拉近
      {
        id: 'terrain-veil',
        type: 'background',
        paint: { 'background-color': '#04121c', 'background-opacity': 0.16 },
      },
      // 战场底图压在薄雾之上：进入战役时它才是主角，不该被总览的暗化处理拖累
      ...detailLayers,
      {
        id: 'province-fill',
        type: 'fill',
        source: 'provinces',
        paint: { 'fill-color': '#0b1720', 'fill-opacity': 0.18 },
      },
      {
        id: 'province-line',
        type: 'line',
        source: 'provinces',
        paint: {
          'line-color': PALETTE.border,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1.1],
          'line-opacity': 0.85,
        },
      },
      {
        id: 'river-line',
        type: 'line',
        source: 'rivers',
        paint: {
          'line-color': PALETTE.water,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 9, 2.2],
          'line-opacity': 0.9,
        },
      },
    ],
  };
}
