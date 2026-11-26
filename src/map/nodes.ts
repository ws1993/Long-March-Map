/**
 * 节点标注：用 DOM Marker 而不是 maplibre 的 symbol layer。
 *
 * 理由：
 * 1. 中文标签无需 glyph 字体服务，离线可用；
 * 2. 可以做丰富的悬停/选中状态与 CSS 动效；
 * 3. 节点总量约 40 个，DOM 完全撑得住。
 *
 * 密度控制：节点按重要性分三级，随缩放逐级展开，避免低 zoom 时挤成一团。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import type { NodeKind, StoryNode } from '../data/types';

export const KIND_META: Record<NodeKind, { label: string; color: string; icon: string }> = {
  meeting: {
    label: '重要会议',
    color: '#f0b73e',
    icon: '<path d="M12 2.6l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9l6.1-.8z"/>',
  },
  battle: {
    label: '重要战役',
    color: '#e0443e',
    icon: '<path d="M4.4 2.4 2.4 4.4 20 22l2-2zM20 2.4l2 2L4.4 22l-2-2z"/>',
  },
  geo: {
    label: '自然险阻',
    color: '#5fc3cf',
    icon: '<path d="M2 19l6.5-11L12 14l2.6-4L22 19z"/>',
  },
  poem: {
    label: '诗词人文',
    color: '#bd8ce0',
    icon: '<path d="M5 3h11a3 3 0 013 3v15H8a3 3 0 01-3-3zM8 7h8v1.6H8zm0 4h8v1.6H8zm0 4h5v1.6H8z"/>',
  },
  event: {
    label: '重大事件',
    color: '#ff9a55',
    icon: '<circle cx="12" cy="12" r="5.2"/>',
  },
  join: {
    label: '部队会师',
    color: '#ffe08a',
    icon: '<path d="M12 3.2l2.3 5 5.5.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.5-.7z" opacity=".95"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".55"/>',
  },
};

/**
 * 一级节点：无论缩放到哪一级都显示，负责撑起长征的骨架。
 */
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

/** 二级：战役、会议、会师、诗词，zoom ≥ 5.2 显示 */
const SECONDARY_KINDS = new Set<NodeKind>(['meeting', 'battle', 'join', 'poem']);

export interface NodeMarker {
  node: StoryNode;
  marker: Marker;
  el: HTMLDivElement;
  tier: 1 | 2 | 3;
}

export interface NodeLayerOptions {
  map: MlMap;
  nodes: StoryNode[];
  onSelect: (node: StoryNode) => void;
}

export class NodeLayer {
  private items: NodeMarker[] = [];
  private cutoff = Number.NEGATIVE_INFINITY;
  private hiddenKinds: Set<NodeKind> = new Set();
  private zoom = 0;
  private map: MlMap;

  constructor(opts: NodeLayerOptions) {
    for (const node of opts.nodes) {
      const meta = KIND_META[node.kind];
      const tier: 1 | 2 | 3 = CORE_IDS.has(node.id) ? 1 : SECONDARY_KINDS.has(node.kind) ? 2 : 3;

      const el = document.createElement('div');
      el.className = `lm-node lm-node--${node.kind} lm-node--t${tier}`;
      el.style.setProperty('--node-color', meta.color);
      el.dataset.nodeId = node.id;
      if (node.confidence !== 'high') el.dataset.conf = node.confidence;
      el.innerHTML = `
        <span class="lm-node__dot">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${meta.icon}</svg>
        </span>
        <span class="lm-node__label">${escapeHtml(node.name)}</span>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onSelect(node);
      });
      el.title = `${node.name}｜${node.place}${node.confidence === 'high' ? '' : '（史实存疑，详见详情）'}`;
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(node.coord).addTo(opts.map);
      this.items.push({ node, marker, el, tier });
    }

    this.map = opts.map;
    this.zoom = opts.map.getZoom();
    this.applyTierVisibility();
    this.applyFlip();
    opts.map.on('zoom', () => {
      this.zoom = opts.map.getZoom();
      this.applyTierVisibility();
    });
    opts.map.on('moveend', () => this.applyFlip());
  }

  /** 节点落在视野右半边时，标签改为朝左伸出，避免溢出屏幕 */
  private applyFlip() {
    const c = this.map.getCenter().lng;
    for (const item of this.items) {
      item.el.classList.toggle('flip-left', item.node.coord[0] > c);
    }
  }

  private applyTierVisibility() {
    const maxTier = this.zoom >= 6.8 ? 3 : this.zoom >= 5.2 ? 2 : 1;
    for (const item of this.items) {
      item.el.classList.toggle('is-collapsed', item.tier > maxTier);
    }
  }

  /** 时间轴联动：未来节点降为"待发生"状态 */
  setDateCutoff(dateStr: string) {
    this.cutoff = Date.parse(`${dateStr}T00:00:00Z`);
    for (const item of this.items) {
      const d = Date.parse(`${item.node.date}T00:00:00Z`);
      if (Number.isNaN(d)) continue;
      item.el.classList.toggle('is-future', d > this.cutoff + 86400000);
    }
  }

  setSelected(id: string | null) {
    for (const item of this.items) {
      item.el.classList.toggle('is-selected', item.node.id === id);
    }
  }

  setVisible(kinds: Set<NodeKind>) {
    this.hiddenKinds = new Set((Object.keys(KIND_META) as NodeKind[]).filter((k) => !kinds.has(k)));
    for (const item of this.items) {
      item.el.classList.toggle('is-hidden', this.hiddenKinds.has(item.node.kind));
    }
  }

  destroy() {
    for (const item of this.items) item.marker.remove();
    this.items = [];
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
