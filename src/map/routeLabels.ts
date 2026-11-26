/**
 * 路线注记：直接在图上标明"这条线是哪支部队"。
 *
 * 为什么不用 symbol layer：maplibre 的 symbol 文字需要 glyph 字体服务，
 * 本项目为了离线可用没有引入 glyphs（节点标注同样走 DOM Marker）。
 * 这里沿用节点层同一套做法：DOM Marker + CSS，中文字体零依赖，且可随图例开关联动隐藏。
 *
 * 位置选择原则：落在该部队路线的中段空地（避开启停节点、左侧图层面板与中央密集节点区），
 * 用一小段渐隐短线指向路线，只作"这是谁的行军线"的指引，不作为精确地理注记。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import { armies } from '../data/armies';

export interface RouteLabel {
  armyId: string;
  coord: [number, number];
  /** 标签朝哪一侧展开，避免压住路线本身 */
  anchor: 'left' | 'right' | 'top' | 'bottom';
  /** 图上的部队短名（army.short 太长，会把周围节点全盖住） */
  title: string;
  /** 起点 → 终点，一句话说明这条线走向 */
  sub: string;
  /** 屏幕像素偏移，微调避让 */
  offset?: [number, number];
}

export const ROUTE_LABELS: RouteLabel[] = [
  {
    armyId: 'red1',
    coord: [115.60, 25.10],
    anchor: 'right',
    title: '红一方面军 · 中央红军',
    sub: '瑞金 → 吴起镇 · 二万五千里',
    offset: [-4, 0],
  },
  {
    armyId: 'red25',
    coord: [106.65, 34.75],
    anchor: 'left',
    title: '红二十五军',
    sub: '何家冲 → 永坪镇 · 最先到达陕北',
    offset: [-6, 0],
  },
  {
    armyId: 'red4',
    coord: [105.55, 32.95],
    anchor: 'left',
    title: '红四方面军',
    sub: '川陕苏区 → 会宁 · 三过草地',
    offset: [4, 0],
  },
  {
    armyId: 'red2',
    coord: [104.90, 27.10],
    anchor: 'left',
    title: '红二方面军',
    sub: '桑植 → 将台堡 · 两万里',
    offset: [4, 6],
  },
];

export class RouteLabelLayer {
  private items: { armyId: string; el: HTMLElement; marker: Marker }[] = [];

  constructor(private map: MlMap) {
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
      this.items.push({ armyId: spec.armyId, el, marker });
    }
  }

  /** 与图例开关同步：被关掉的部队，其路线注记一并隐去 */
  setVisible(ids: Set<string>) {
    for (const item of this.items) {
      item.el.classList.toggle('is-off', !ids.has(item.armyId));
    }
  }

  /** 态势模式下整层收起 */
  setMode(situation: boolean) {
    for (const item of this.items) item.el.classList.toggle('is-mode-hidden', situation);
  }
}
