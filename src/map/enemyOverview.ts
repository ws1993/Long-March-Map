/**
 * 总览主图的敌军围追堵截态势图层（随底部时间轴平滑淡入淡出）。
 */
import { Marker } from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import { overviewEnemyCampaigns } from '../data/enemy-overview';
import type { LonLat } from '../data/types';
import { PALETTE } from './basemap';
import { parseLooseDate } from './routes';
import { buildSituationGeometry } from './situation';

const DAY_MS = 86400000;

interface PreparedCampaign {
  id: string;
  tFrom: number;
  tTo: number;
  fadeInMs: number;
  fadeOutMs: number;
  polygons: GeoJSON.Feature[];
  lines: GeoJSON.Feature[];
  labels: { coord: LonLat; text: string }[];
}

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export class OverviewEnemyLayer {
  private prepared: PreparedCampaign[] = [];
  private labelPool: { key: string; marker: Marker; el: HTMLDivElement }[] = [];
  private enabled = true;
  private inSituationMode = false;
  private lastTs = parseLooseDate('1934-10-10');

  constructor(private map: MlMap) {
    this.map.addSource('enemy-ov-polygons', { type: 'geojson', data: empty });
    this.map.addSource('enemy-ov-lines', { type: 'geojson', data: empty });

    // 放在路线图层之下（紧邻 routes-future-line 之前），作为战略态势背景层，不遮盖红军路线
    const beforeId = this.map.getLayer('routes-future-line') ? 'routes-future-line' : undefined;

    this.map.addLayer(
      {
        id: 'enemy-ov-fill',
        type: 'fill',
        source: 'enemy-ov-polygons',
        paint: {
          'fill-color': PALETTE.enemy,
          'fill-opacity': [
            '*',
            ['coalesce', ['get', 'alpha'], 1],
            ['case', ['==', ['get', 'outlineOnly'], true], 0.06, 0.2],
          ],
        },
      },
      beforeId,
    );

    this.map.addLayer(
      {
        id: 'enemy-ov-outline',
        type: 'line',
        source: 'enemy-ov-polygons',
        paint: {
          'line-color': '#6ea6de',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 1.0, 8, 1.9],
          'line-opacity': ['*', 0.85, ['coalesce', ['get', 'alpha'], 1]],
        },
      },
      beforeId,
    );

    this.map.addLayer(
      {
        id: 'enemy-ov-axis',
        type: 'line',
        source: 'enemy-ov-lines',
        paint: {
          'line-color': '#6ea6de',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 1.4, 8, 2.2],
          'line-dasharray': [3, 2.2],
          'line-opacity': ['*', 0.78, ['coalesce', ['get', 'alpha'], 1]],
        },
      },
      beforeId,
    );

    for (const c of overviewEnemyCampaigns) {
      const geo = buildSituationGeometry(
        { id: c.id, date: c.from, title: c.title, narrative: '', graphics: c.graphics },
        1,
      );
      this.prepared.push({
        id: c.id,
        tFrom: parseLooseDate(c.from),
        tTo: parseLooseDate(c.to) + DAY_MS,
        fadeInMs: (c.fadeInDays ?? 6) * DAY_MS,
        fadeOutMs: (c.fadeOutDays ?? 10) * DAY_MS,
        polygons: geo.polygons.features,
        lines: geo.lines.features,
        labels: geo.labels.map((l) => ({ coord: l.coord, text: l.text })),
      });

      geo.labels.forEach((lb, idx) => {
        const key = `${c.id}-${idx}`;
        const el = document.createElement('div');
        el.className = 'lm-enemy-ov-label';
        el.innerHTML = `<span class="lm-enemy-ov-label__tag">敌</span><span>${lb.text}</span>`;
        const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(lb.coord).addTo(this.map);
        this.labelPool.push({ key, marker, el });
      });
    }
  }

  private weightAt(c: PreparedCampaign, ts: number): number {
    if (ts < c.tFrom - c.fadeInMs || ts > c.tTo + c.fadeOutMs) return 0;
    if (ts < c.tFrom) {
      return c.fadeInMs > 0 ? Math.max(0, (ts - (c.tFrom - c.fadeInMs)) / c.fadeInMs) : 1;
    }
    if (ts > c.tTo) {
      return c.fadeOutMs > 0 ? Math.max(0, 1 - (ts - c.tTo) / c.fadeOutMs) : 0;
    }
    return 1;
  }

  setDate(dateOrTs: string | number) {
    this.lastTs = typeof dateOrTs === 'number' ? dateOrTs : parseLooseDate(dateOrTs);
    this.render();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.render();
  }

  setMode(situationMode: boolean) {
    this.inSituationMode = situationMode;
    this.render();
  }

  get isEnabled() {
    return this.enabled;
  }

  private render() {
    const visible = this.enabled && !this.inSituationMode;
    if (!visible) {
      (this.map.getSource('enemy-ov-polygons') as GeoJSONSource | undefined)?.setData(empty);
      (this.map.getSource('enemy-ov-lines') as GeoJSONSource | undefined)?.setData(empty);
      for (const item of this.labelPool) {
        item.el.style.opacity = '0';
        item.el.classList.add('is-hidden');
      }
      return;
    }

    const polys: GeoJSON.Feature[] = [];
    const lines: GeoJSON.Feature[] = [];
    const alphaByKey = new Map<string, number>();

    for (const c of this.prepared) {
      const w = this.weightAt(c, this.lastTs);
      if (w <= 0.02) continue;
      const eased = w * w * (3 - 2 * w); // smoothstep
      for (const f of c.polygons) {
        polys.push({ ...f, properties: { ...(f.properties ?? {}), alpha: eased } });
      }
      for (const f of c.lines) {
        lines.push({ ...f, properties: { ...(f.properties ?? {}), alpha: eased } });
      }
      c.labels.forEach((_, idx) => alphaByKey.set(`${c.id}-${idx}`, eased));
    }

    (this.map.getSource('enemy-ov-polygons') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: polys,
    });
    (this.map.getSource('enemy-ov-lines') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: lines,
    });

    for (const item of this.labelPool) {
      const a = alphaByKey.get(item.key) ?? 0;
      if (a <= 0.04) {
        item.el.style.opacity = '0';
        item.el.classList.add('is-hidden');
      } else {
        item.el.classList.remove('is-hidden');
        item.el.style.opacity = String(Math.min(0.95, a * 0.95));
      }
    }
  }
}
