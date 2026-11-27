/**
 * 图面路线注记、行军推进挂签与底图省河注记。
 *
 * 防压盖减负改进：
 * 1. 彻底移除已到达终点（status === 'arrived'）的「胜利会师·抵达…」挂签，避免与会师节点重复叠压；
 * 2. 进入六大战役特写场景时，自动隐去静态双行路线说明卡与行军挂签，把图面空间完全留给战役态势；
 * 3. 非场景状态下路线说明卡亦受屏幕碰撞控制，不再压盖节点与主线。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import { armies } from '../data/armies';
import type { LonLat } from '../data/types';
import { estimateTextWidth, type LabelArbiter } from './labelArbiter';
import type { RouteHead } from './routes';

export interface RouteLabel {
  armyId: string;
  coord: LonLat;
  anchor: 'left' | 'right' | 'top' | 'bottom';
  title: string;
  sub: string;
  offset?: [number, number];
  minZoom?: number;
}

export const ROUTE_LABELS: RouteLabel[] = [
  {
    armyId: 'red1',
    coord: [114.25, 24.85],
    anchor: 'left',
    title: '红一方面军（中央红军）',
    sub: '瑞金出发 · 二万五千里',
    offset: [6, 4],
  },
  {
    armyId: 'red1',
    coord: [103.35, 25.05],
    anchor: 'left',
    title: '红一方面军',
    sub: '西进云南 · 巧渡金沙江',
    offset: [6, 6],
    minZoom: 5.55,
  },
  {
    armyId: 'red1',
    coord: [101.55, 28.75],
    anchor: 'right',
    title: '红一方面军',
    sub: '强渡大渡河 · 爬雪山过草地',
    offset: [-8, 0],
    minZoom: 5.7,
  },
  {
    armyId: 'red25',
    coord: [111.55, 34.25],
    anchor: 'left',
    title: '红二十五军',
    sub: '何家冲出发 · 最先抵达陕北',
    offset: [6, -6],
  },
  {
    armyId: 'red4',
    coord: [105.55, 32.85],
    anchor: 'left',
    title: '红四方面军',
    sub: '强渡嘉陵江 · 三过草地',
    offset: [6, -4],
  },
  {
    armyId: 'red4',
    coord: [100.35, 30.72],
    anchor: 'right',
    title: '红四方面军',
    sub: '转战川康 · 甘孜会师北上',
    offset: [-8, 6],
    minZoom: 5.6,
  },
  {
    armyId: 'red2',
    coord: [110.25, 28.45],
    anchor: 'left',
    title: '红二方面军（红二、六军团）',
    sub: '桑植突围 · 转战乌蒙金沙',
    offset: [8, 0],
  },
  {
    armyId: 'red2',
    coord: [99.05, 28.95],
    anchor: 'right',
    title: '红二方面军',
    sub: '石鼓渡江 · 经康南至将台堡',
    offset: [-8, 0],
    minZoom: 5.6,
  },
];

interface GeoAnnotation {
  text: string;
  coord: LonLat;
  kind: 'province' | 'river';
  minZoom?: number;
  rotate?: number;
}

const GEO_ANNOTATIONS: GeoAnnotation[] = [
  { text: '江 西', coord: [115.65, 27.35], kind: 'province' },
  { text: '湖 南', coord: [111.85, 27.65], kind: 'province' },
  { text: '广 西', coord: [108.95, 24.55], kind: 'province' },
  { text: '贵 州', coord: [107.35, 26.55], kind: 'province' },
  { text: '云 南', coord: [101.65, 24.65], kind: 'province' },
  { text: '四 川', coord: [104.65, 30.65], kind: 'province' },
  { text: '西 康', coord: [99.55, 30.35], kind: 'province' },
  { text: '河 南', coord: [113.55, 34.15], kind: 'province' },
  { text: '湖 北', coord: [111.75, 31.25], kind: 'province' },
  { text: '陕 西', coord: [108.95, 34.85], kind: 'province' },
  { text: '甘 肃', coord: [104.15, 35.85], kind: 'province' },
  { text: '宁 夏', coord: [106.15, 37.35], kind: 'province' },

  { text: '长江', coord: [106.55, 29.55], kind: 'river', minZoom: 4.8, rotate: -18 },
  { text: '黄河', coord: [110.35, 36.15], kind: 'river', minZoom: 4.8, rotate: 82 },
  { text: '金沙江', coord: [101.65, 26.22], kind: 'river', minZoom: 5.45, rotate: -15 },
  { text: '大渡河', coord: [102.02, 29.58], kind: 'river', minZoom: 5.45, rotate: 75 },
  { text: '乌江', coord: [107.62, 27.68], kind: 'river', minZoom: 5.55, rotate: -28 },
  { text: '湘江', coord: [111.15, 26.38], kind: 'river', minZoom: 5.55, rotate: -65 },
  { text: '嘉陵江', coord: [106.08, 31.35], kind: 'river', minZoom: 5.55, rotate: 68 },
  { text: '赤水河', coord: [105.72, 28.48], kind: 'river', minZoom: 6.3, rotate: -35 },
];

const ARMY_BADGE_NAME: Record<string, string> = {
  red1: '红一方面军',
  red25: '红二十五军',
  red4: '红四方面军',
  red2: '红二方面军',
};

function compactStageLabel(s: string): string {
  const first = s.split(' · ')[0] ?? s;
  return first.length > 10 ? first.slice(0, 10) : first;
}

export class RouteLabelLayer {
  private routeItems: { spec: RouteLabel; el: HTMLElement; marker: Marker }[] = [];
  private geoItems: { spec: GeoAnnotation; el: HTMLElement; marker: Marker }[] = [];
  private headPool = new Map<
    string,
    { marker: Marker; el: HTMLDivElement; pillEl: HTMLElement; nameEl: HTMLElement; stageEl: HTMLElement }
  >();
  private visibleArmies = new Set<string>(armies.map((a) => a.id));
  private geoEnabled = true;
  private sceneActive = false;
  private latestHeads: RouteHead[] = [];

  constructor(
    private map: MlMap,
    private onRequestLayout?: () => void,
  ) {
    for (const spec of GEO_ANNOTATIONS) {
      const el = document.createElement('div');
      el.className = `lm-geo-label lm-geo-label--${spec.kind}`;
      const inner = document.createElement('span');
      inner.textContent = spec.text;
      if (spec.rotate) inner.style.transform = `rotate(${spec.rotate}deg)`;
      el.appendChild(inner);
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(spec.coord).addTo(this.map);
      this.geoItems.push({ spec, el, marker });
    }

    for (const spec of ROUTE_LABELS) {
      const army = armies.find((a) => a.id === spec.armyId);
      if (!army) continue;

      const el = document.createElement('div');
      el.className = `lm-route-label lm-route-label--${spec.anchor}`;
      el.style.setProperty('--route-color', army.color);
      el.innerHTML = `
        <span class="lm-route-label__dash" aria-hidden="true"></span>
        <span class="lm-route-label__text">
          <strong>${spec.title}</strong>
          <em>${spec.sub}</em>
        </span>`;
      el.title = `${army.name}｜${army.startPlace} → ${army.endPlace}`;

      const marker = new Marker({ element: el, anchor: spec.anchor, offset: spec.offset ?? [0, 0] })
        .setLngLat(spec.coord)
        .addTo(this.map);
      this.routeItems.push({ spec, el, marker });
    }

    for (const army of armies) {
      const el = document.createElement('div');
      el.className = 'lm-head-badge is-hidden';
      el.style.setProperty('--head-color', army.color);
      el.innerHTML = `
        <div class="lm-head-badge__pill" data-align="left" style="left:11px;top:0">
          <span class="lm-head-badge__army"></span>
          <span class="lm-head-badge__stage"></span>
        </div>
      `;
      const pillEl = el.querySelector('.lm-head-badge__pill') as HTMLElement;
      const nameEl = el.querySelector('.lm-head-badge__army') as HTMLElement;
      const stageEl = el.querySelector('.lm-head-badge__stage') as HTMLElement;
      nameEl.textContent = ARMY_BADGE_NAME[army.id] ?? army.short;

      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat([106, 30]).addTo(this.map);
      this.headPool.set(army.id, { marker, el, pillEl, nameEl, stageEl });
    }
  }

  setSceneActive(active: boolean) {
    this.sceneActive = active;
  }

  updateHeads(heads: RouteHead[]) {
    this.latestHeads = heads;
    this.onRequestLayout?.();
  }

  /** 在统一排版阶段更新省河注记、行军挂签与静态路线签（全部受碰撞与场景减法约束） */
  placeLabels(arbiter: LabelArbiter) {
    const z = this.map.getZoom();
    const isL1 = z < 5.45;

    // 1. 底图省区与主要河流
    for (const g of this.geoItems) {
      const zoomOk = g.spec.minZoom === undefined || z >= g.spec.minZoom;
      const show = this.geoEnabled && zoomOk;
      g.el.classList.toggle('is-off', !show);
    }

    // 2. 正在行进中的部队推进圆点挂签（已到达终点或处于战役特写场景中时一律隐藏，绝不堆叠）
    for (const [armyId, entry] of this.headPool) {
      const h = this.latestHeads.find(
        (x) => x.army.id === armyId && x.status === 'marching',
      );
      if (!h || this.sceneActive || !this.visibleArmies.has(armyId)) {
        entry.el.classList.add('is-hidden');
        continue;
      }

      const stageText = compactStageLabel(h.label);
      if (entry.stageEl.textContent !== stageText) entry.stageEl.textContent = stageText;
      entry.el.classList.toggle('is-compact', isL1);
      entry.marker.setLngLat(h.coord);
      arbiter.reserveIcon(h.coord, 8);

      const fullText = isL1 ? entry.nameEl.textContent ?? '' : `${entry.nameEl.textContent} ${stageText}`;
      const w = estimateTextWidth(fullText, 11, 18);
      const choice = arbiter.placeAroundPoint(h.coord, w, 20, { gap: 11 });
      if (choice) {
        entry.pillEl.dataset.align = choice.align;
        entry.pillEl.style.left = `${choice.dx.toFixed(1)}px`;
        entry.pillEl.style.top = `${choice.dy.toFixed(1)}px`;
        entry.el.classList.remove('is-hidden');
      } else {
        entry.el.classList.add('is-hidden');
      }
    }

    // 3. 静态部队路线指引签：战役场景中隐藏；平时仅在无碰撞处显示
    for (const item of this.routeItems) {
      const zoomOk = item.spec.minZoom === undefined || z >= item.spec.minZoom;
      if (this.sceneActive || !this.visibleArmies.has(item.spec.armyId) || !zoomOk) {
        item.el.classList.add('is-off');
        continue;
      }
      item.el.classList.toggle('is-compact', isL1);
      const w = estimateTextWidth(item.spec.title, 11.5, 28);
      const h = isL1 ? 18 : 32;
      const choice = arbiter.placeAroundPoint(item.spec.coord, w, h, {
        gap: 6,
        preferred: item.spec.anchor === 'right' ? 'right' : 'left',
      });
      item.el.classList.toggle('is-off', !choice);
    }
  }

  setVisible(ids: Set<string>) {
    this.visibleArmies = new Set(ids);
    this.onRequestLayout?.();
  }

  setGeoEnabled(on: boolean) {
    this.geoEnabled = on;
    this.onRequestLayout?.();
  }

  get isGeoEnabled() {
    return this.geoEnabled;
  }
}
