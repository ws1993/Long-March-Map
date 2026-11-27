/**
 * 节点标注：用 DOM Marker 而不是 maplibre 的 symbol layer。
 *
 * 理由：
 * 1. 中文标签无需 glyph 字体服务，离线可用；
 * 2. 可以做丰富的悬停/选中状态与 CSS 动效；
 * 3. 节点总量 50 个，DOM 完全撑得住。
 *
 * 文字可见性与防重叠策略：
 * - 一级骨架节点（13 个）在全缩放级别默认常显短名称，用户无需对照图例即可读懂主干地标；
 * - 放大到 zoom >= 5.3 / 6.5 时逐级展开二、三级节点的图标与名称；
 * - 每次缩放/平移/选中时在屏幕像素空间做一次轻量矩形碰撞检测（优先保留选中项与高级别节点，
 *   左右两侧自动择空翻转），既保证地标可读，又避免低缩放密集区文字叠压。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import type { NodeKind, StoryNode } from '../data/types';

export const KIND_META: Record<NodeKind, { label: string; shortTag: string; color: string; icon: string }> = {
  meeting: {
    label: '重要会议',
    shortTag: '会议',
    color: '#f0b73e',
    icon: '<path d="M12 2.6l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9l6.1-.8z"/>',
  },
  battle: {
    label: '重要战役',
    shortTag: '战役',
    color: '#e0443e',
    icon: '<path d="M4.4 2.4 2.4 4.4 20 22l2-2zM20 2.4l2 2L4.4 22l-2-2z"/>',
  },
  geo: {
    label: '自然险阻',
    shortTag: '险阻',
    color: '#5fc3cf',
    icon: '<path d="M2 19l6.5-11L12 14l2.6-4L22 19z"/>',
  },
  poem: {
    label: '诗词人文',
    shortTag: '诗词',
    color: '#bd8ce0',
    icon: '<path d="M5 3h11a3 3 0 013 3v15H8a3 3 0 01-3-3zM8 7h8v1.6H8zm0 4h8v1.6H8zm0 4h5v1.6H8z"/>',
  },
  event: {
    label: '重大事件',
    shortTag: '事件',
    color: '#ff9a55',
    icon: '<circle cx="12" cy="12" r="5.2"/>',
  },
  join: {
    label: '部队会师',
    shortTag: '会师',
    color: '#ffe08a',
    icon: '<path d="M12 3.2l2.3 5 5.5.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.5-.7z" opacity=".95"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".55"/>',
  },
};

/** 一级骨架节点：全缩放级别始终显示图标并优先常显名称 */
const CORE_IDS = new Set([
  'n-ruijin',
  'n-xiangjiang',
  'n-zunyi',
  'n-jinsha',
  'n-luding',
  'n-maogong',
  'n-grassland',
  'n-wuqi',
  'n-huining',
  'n-jiangtaibao',
  'n-sangzhi',
  'n-hejiachong',
  'n-jialing',
]);

/** 图面紧凑短名（详情抽屉与悬停提示仍保留完整标题） */
const SHORT_NAMES: Record<string, string> = {
  'n-ruijin': '瑞金出发',
  'n-hejiachong': '何家冲出发',
  'n-sangzhi': '桑植出发',
  'n-yongping': '永坪镇会师',
  'n-tongdao': '通道转兵',
  'n-tucheng': '土城战斗',
  'n-dadu': '强渡大渡河',
  'n-grassland': '过草地',
  'n-lazikou': '突破腊子口',
  'n-wuqi': '吴起镇会师',
};

/** 二级：战役、会议、会师、诗词，zoom ≥ 5.2 显示图标，zoom ≥ 5.4 参与常显标签排布 */
const SECONDARY_KINDS = new Set<NodeKind>(['meeting', 'battle', 'join', 'poem']);

export interface NodeMarker {
  node: StoryNode;
  shortName: string;
  marker: Marker;
  el: HTMLDivElement;
  tier: 1 | 2 | 3;
}

export interface NodeLayerOptions {
  map: MlMap;
  nodes: StoryNode[];
  onSelect: (node: StoryNode) => void;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export class NodeLayer {
  private items: NodeMarker[] = [];
  private cutoff = Number.NEGATIVE_INFINITY;
  private hiddenKinds: Set<NodeKind> = new Set();
  private selectedId: string | null = null;
  private zoom = 0;
  private map: MlMap;

  constructor(opts: NodeLayerOptions) {
    for (const node of opts.nodes) {
      const meta = KIND_META[node.kind];
      const tier: 1 | 2 | 3 = CORE_IDS.has(node.id) ? 1 : SECONDARY_KINDS.has(node.kind) ? 2 : 3;
      const shortName = SHORT_NAMES[node.id] ?? node.name;

      const el = document.createElement('div');
      el.className = `lm-node lm-node--${node.kind} lm-node--t${tier}`;
      el.style.setProperty('--node-color', meta.color);
      el.dataset.nodeId = node.id;
      if (node.confidence !== 'high') el.dataset.conf = node.confidence;
      el.innerHTML = `
        <span class="lm-node__dot">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${meta.icon}</svg>
        </span>
        <span class="lm-node__label">
          <i class="lm-node__tag">${meta.shortTag}</i>${escapeHtml(shortName)}
        </span>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onSelect(node);
      });
      el.title = `${node.name}（${meta.label}）｜${node.place}${
        node.confidence === 'high' ? '' : '｜史实存疑，点击查看详情'
      }`;
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(node.coord).addTo(opts.map);
      this.items.push({ node, shortName, marker, el, tier });
    }

    this.map = opts.map;
    this.zoom = opts.map.getZoom();
    this.refreshLayout();
    opts.map.on('zoom', () => {
      this.zoom = opts.map.getZoom();
      this.refreshLayout();
    });
    opts.map.on('moveend', () => this.refreshLayout());
  }

  private refreshLayout() {
    const maxIconTier = this.zoom >= 6.5 ? 3 : this.zoom >= 5.2 ? 2 : 1;
    const maxLabelTier = this.zoom >= 6.6 ? 3 : this.zoom >= 5.4 ? 2 : 1;
    const width = this.map.getContainer().clientWidth || 1280;

    const occupied: Box[] = [];
    const candidates: { item: NodeMarker; cx: number; cy: number; isFuture: boolean; isSelected: boolean }[] = [];

    for (const item of this.items) {
      const hiddenByKind = this.hiddenKinds.has(item.node.kind);
      const isSelected = item.node.id === this.selectedId;
      const collapsed = !isSelected && item.tier > maxIconTier;

      item.el.classList.toggle('is-hidden', hiddenByKind);
      item.el.classList.toggle('is-collapsed', collapsed);

      if (hiddenByKind || collapsed) {
        item.el.classList.remove('is-label-shown');
        continue;
      }

      const pt = this.map.project(item.node.coord);
      // 先占据图标圆点自身的碰撞盒，避免其他节点的文字压住图标
      occupied.push({ x0: pt.x - 12, y0: pt.y - 11, x1: pt.x + 12, y1: pt.y + 11 });

      const isFuture = item.el.classList.contains('is-future');
      if (isSelected || item.tier <= maxLabelTier) {
        candidates.push({ item, cx: pt.x, cy: pt.y, isFuture, isSelected });
      } else {
        item.el.classList.remove('is-label-shown');
        item.el.classList.toggle('flip-left', pt.x > width * 0.68);
      }
    }

    // 优先级：当前选中 > 一级骨架节点 > 已到达节点 > 二/三级节点
    candidates.sort((a, b) => {
      if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1;
      if (a.item.tier !== b.item.tier) return a.item.tier - b.item.tier;
      if (a.isFuture !== b.isFuture) return a.isFuture ? 1 : -1;
      return 0;
    });

    for (const c of candidates) {
      // 估算标签宽高（含类型小徽章 + 短名称）
      const labelW = c.item.shortName.length * 12 + 44;
      const labelH = 21;
      const preferLeft = c.cx > width * 0.72;
      const sides: boolean[] = preferLeft ? [true, false] : [false, true];

      let placed = false;
      for (const left of sides) {
        const box: Box = left
          ? { x0: c.cx - 15 - labelW, y0: c.cy - labelH / 2, x1: c.cx - 15, y1: c.cy + labelH / 2 }
          : { x0: c.cx + 15, y0: c.cy - labelH / 2, x1: c.cx + 15 + labelW, y1: c.cy + labelH / 2 };

        if (c.isSelected || !occupied.some((o) => overlaps(box, o))) {
          c.item.el.classList.toggle('flip-left', left);
          c.item.el.classList.add('is-label-shown');
          occupied.push({ x0: box.x0 - 3, y0: box.y0 - 2, x1: box.x1 + 3, y1: box.y1 + 2 });
          placed = true;
          break;
        }
      }

      if (!placed) {
        c.item.el.classList.remove('is-label-shown');
        c.item.el.classList.toggle('flip-left', preferLeft);
      }
    }
  }

  /** 时间轴联动：未来节点降为"待发生"状态 */
  setDateCutoff(dateStr: string) {
    const nextCutoff = Date.parse(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(nextCutoff)) return;
    this.cutoff = nextCutoff;
    let changed = false;
    for (const item of this.items) {
      const d = Date.parse(`${item.node.date}T00:00:00Z`);
      if (Number.isNaN(d)) continue;
      const nextFuture = d > this.cutoff + 86400000;
      if (item.el.classList.contains('is-future') !== nextFuture) {
        item.el.classList.toggle('is-future', nextFuture);
        changed = true;
      }
    }
    if (changed) this.refreshLayout();
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    for (const item of this.items) {
      item.el.classList.toggle('is-selected', item.node.id === id);
    }
    this.refreshLayout();
  }

  setVisible(kinds: Set<NodeKind>) {
    this.hiddenKinds = new Set((Object.keys(KIND_META) as NodeKind[]).filter((k) => !kinds.has(k)));
    this.refreshLayout();
  }

  destroy() {
    for (const item of this.items) item.marker.remove();
    this.items = [];
  }
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
