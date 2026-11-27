/**
 * 图面文字说明体系（全部走 DOM Marker，零外部字体服务依赖，离线完整可用）：
 * 1. 多锚点部队路线注记（ROUTE_LABELS）—— 长路线分段设多处指引，随缩放展开，不必靠图例辨色；
 * 2. 行军推进圆点实时挂签（updateHeads）—— 时间轴推进时实时标出「哪支部队 · 正在执行哪段行动」，
 *    多军交汇时自动在屏幕四个象限错开避让；
 * 3. 底图省名与关键水系注记（PROVINCE_LABELS / RIVER_LABELS）—— 提供历史地理空间方位参照。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import { armies } from '../data/armies';
import type { LonLat } from '../data/types';
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
  // 红一方面军（横跨 11 省，设 4 处区域锚点）
  {
    armyId: 'red1',
    coord: [114.25, 24.85],
    anchor: 'left',
    title: '红一方面军（中央红军）',
    sub: '瑞金出发 · 突破四道封锁线',
    offset: [4, 4],
  },
  {
    armyId: 'red1',
    coord: [103.35, 25.05],
    anchor: 'left',
    title: '红一方面军',
    sub: '兵临贵阳 · 西进巧渡金沙江',
    offset: [4, 6],
    minZoom: 4.9,
  },
  {
    armyId: 'red1',
    coord: [101.65, 28.75],
    anchor: 'right',
    title: '红一方面军',
    sub: '强渡大渡河 · 翻夹金山过草地',
    offset: [-6, 0],
    minZoom: 5.1,
  },
  {
    armyId: 'red1',
    coord: [107.35, 36.68],
    anchor: 'left',
    title: '红一方面军（陕甘支队）',
    sub: '越六盘山 · 抵达陕北吴起镇',
    offset: [8, -4],
    minZoom: 4.8,
  },

  // 红二十五军（2 处锚点）
  {
    armyId: 'red25',
    coord: [111.55, 34.18],
    anchor: 'left',
    title: '红二十五军',
    sub: '何家冲出发 · 创建鄂豫陕根据地',
    offset: [4, -6],
  },
  {
    armyId: 'red25',
    coord: [107.55, 35.25],
    anchor: 'left',
    title: '红二十五军',
    sub: '西进陇东 · 最先抵达陕北永坪镇',
    offset: [6, 6],
    minZoom: 5.2,
  },

  // 红四方面军（2 处锚点）
  {
    armyId: 'red4',
    coord: [105.55, 32.85],
    anchor: 'left',
    title: '红四方面军',
    sub: '强渡嘉陵江 · 撤离川陕苏区西进',
    offset: [6, -4],
  },
  {
    armyId: 'red4',
    coord: [100.35, 30.72],
    anchor: 'right',
    title: '红四方面军',
    sub: '南下川康边 · 甘孜会师后三过草地北上',
    offset: [-6, 6],
    minZoom: 4.9,
  },

  // 红二方面军（2 处锚点）
  {
    armyId: 'red2',
    coord: [110.25, 28.45],
    anchor: 'left',
    title: '红二、六军团（红二方面军）',
    sub: '桑植突围 · 经湘黔乌蒙山回旋',
    offset: [8, 0],
  },
  {
    armyId: 'red2',
    coord: [99.05, 28.95],
    anchor: 'right',
    title: '红二方面军',
    sub: '石鼓渡金沙江 · 经康南至甘孜北上将台堡',
    offset: [-6, 0],
    minZoom: 4.8,
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
  // 途经主要省区（含历史政区西康）
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

  // 关键江河参照
  { text: '长江', coord: [106.55, 29.55], kind: 'river', rotate: -18 },
  { text: '金沙江', coord: [101.65, 26.22], kind: 'river', rotate: -15 },
  { text: '大渡河', coord: [102.02, 29.58], kind: 'river', minZoom: 4.5, rotate: 75 },
  { text: '赤水河', coord: [105.72, 28.48], kind: 'river', minZoom: 4.9, rotate: -35 },
  { text: '乌江', coord: [107.62, 27.68], kind: 'river', minZoom: 4.7, rotate: -28 },
  { text: '湘江', coord: [111.15, 26.38], kind: 'river', minZoom: 4.7, rotate: -65 },
  { text: '嘉陵江', coord: [106.08, 31.35], kind: 'river', minZoom: 4.8, rotate: 68 },
  { text: '黄河', coord: [110.35, 36.15], kind: 'river', rotate: 82 },
];

const ARMY_BADGE_NAME: Record<string, string> = {
  red1: '红一方面军',
  red25: '红二十五军',
  red4: '红四方面军',
  red2: '红二方面军',
};

function compactStageLabel(s: string): string {
  const parts = s.split(' · ');
  if (parts.length <= 2 && s.length <= 15) return s;
  return parts.slice(0, 2).join(' · ');
}

export class RouteLabelLayer {
  private routeItems: { spec: RouteLabel; el: HTMLElement; marker: Marker }[] = [];
  private geoItems: { spec: GeoAnnotation; el: HTMLElement; marker: Marker }[] = [];
  private headPool = new Map<
    string,
    { marker: Marker; el: HTMLDivElement; nameEl: HTMLElement; stageEl: HTMLElement }
  >();
  private visibleArmies = new Set<string>(armies.map((a) => a.id));
  private geoEnabled = true;
  private situationMode = false;
  private latestHeads: RouteHead[] = [];

  constructor(private map: MlMap) {
    // 1. 底图省名与河流注记（最底层 DOM 注记）
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

    // 2. 多锚点部队路线注记
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

    // 3. 四支主力实时行军头挂签池（外层交由 MapLibre transform 定位，内层 pill 控制四象限偏移）
    for (const army of armies) {
      const el = document.createElement('div');
      el.className = 'lm-head-badge is-hidden';
      el.style.setProperty('--head-color', army.color);
      el.innerHTML = `
        <div class="lm-head-badge__pill" data-slot="0">
          <span class="lm-head-badge__army"></span>
          <span class="lm-head-badge__stage"></span>
        </div>
      `;
      const nameEl = el.querySelector('.lm-head-badge__army') as HTMLElement;
      const stageEl = el.querySelector('.lm-head-badge__stage') as HTMLElement;
      nameEl.textContent = ARMY_BADGE_NAME[army.id] ?? army.short;

      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([106, 30])
        .addTo(this.map);
      this.headPool.set(army.id, { marker, el, nameEl, stageEl });
    }

    this.syncVisibility();
    this.map.on('zoom', () => {
      this.syncVisibility();
      this.layoutHeadBadges();
    });
    this.map.on('moveend', () => this.layoutHeadBadges());
  }

  private syncVisibility() {
    const z = this.map.getZoom();

    for (const item of this.routeItems) {
      const zoomOk = item.spec.minZoom === undefined || z >= item.spec.minZoom;
      const show = !this.situationMode && this.visibleArmies.has(item.spec.armyId) && zoomOk;
      item.el.classList.toggle('is-off', !show);
    }

    for (const g of this.geoItems) {
      const zoomOk = g.spec.minZoom === undefined || z >= g.spec.minZoom;
      const show = !this.situationMode && this.geoEnabled && zoomOk;
      g.el.classList.toggle('is-off', !show);
    }
  }

  /** 更新四支队伍行军推进头的实时番号阶段标签，并在多军靠近时自动错开象限 */
  updateHeads(heads: RouteHead[]) {
    this.latestHeads = heads;
    this.layoutHeadBadges();
  }

  private layoutHeadBadges() {
    const activeByArmy = new Map<string, RouteHead>();
    for (const h of this.latestHeads) {
      if (!this.situationMode && this.visibleArmies.has(h.army.id)) {
        activeByArmy.set(h.army.id, h);
      }
    }

    // 计算屏幕像素位置，若两军推进头距离 < 110px 则分配不同象限槽位，避免会师前后重叠
    const placedPts: { x: number; y: number; slot: number }[] = [];

    for (const [armyId, entry] of this.headPool) {
      const h = activeByArmy.get(armyId);
      if (!h) {
        entry.el.classList.add('is-hidden');
        continue;
      }

      entry.el.classList.remove('is-hidden');
      entry.el.classList.toggle('is-arrived', h.status === 'arrived');
      const stageText = compactStageLabel(h.label);
      if (entry.stageEl.textContent !== stageText) {
        entry.stageEl.textContent = stageText;
      }
      entry.marker.setLngLat(h.coord);

      const pt = this.map.project(h.coord);
      let slot = 0;
      const usedSlots = new Set<number>();
      for (const prev of placedPts) {
        if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 110) usedSlots.add(prev.slot);
      }
      while (usedSlots.has(slot) && slot < 3) slot++;
      placedPts.push({ x: pt.x, y: pt.y, slot });

      const pill = entry.el.firstElementChild as HTMLElement | null;
      if (pill) pill.dataset.slot = String(slot);
    }
  }

  /** 与图例开关同步：被关掉的部队，其路线注记与行军挂签一并隐去 */
  setVisible(ids: Set<string>) {
    this.visibleArmies = new Set(ids);
    this.syncVisibility();
    this.layoutHeadBadges();
  }

  /** 底图省名/水系注记显隐开关 */
  setGeoEnabled(on: boolean) {
    this.geoEnabled = on;
    this.syncVisibility();
  }

  get isGeoEnabled() {
    return this.geoEnabled;
  }

  /** 态势模式下整层收起 */
  setMode(situation: boolean) {
    this.situationMode = situation;
    this.syncVisibility();
    this.layoutHeadBadges();
  }
}
