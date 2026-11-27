/**
 * 节点标注层：接入全局 LabelArbiter 四向避让与场景焦点过滤。
 *
 * 减负与防压盖规则：
 * - 图面标签采用高对比深色光晕描边字（Halo），仅在悬停或选中时浮现深色胶囊底衬，消除满屏黑块；
 * - 进入战役场景时，仅当前节拍点名的 `focusNodes`（及当前选中节点）参与常显排布，
 *   其余背景节点退回安静图标态（悬停仍可即时显字），彻底消除无关诗词/历史节点抢戏。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import type { NodeKind, StoryNode } from '../data/types';
import { estimateTextWidth, type LabelArbiter } from './labelArbiter';

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

const MACRO_LABEL_IDS = new Set([
  'n-ruijin',
  'n-zunyi',
  'n-luding',
  'n-maogong',
  'n-wuqi',
  'n-huining',
]);

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

const SECONDARY_KINDS = new Set<NodeKind>(['meeting', 'battle', 'join', 'poem']);

export interface NodeMarker {
  node: StoryNode;
  shortName: string;
  marker: Marker;
  el: HTMLDivElement;
  labelEl: HTMLElement;
  tier: 1 | 2 | 3;
}

export interface NodeLayerOptions {
  map: MlMap;
  nodes: StoryNode[];
  onSelect: (node: StoryNode) => void;
  onRequestLayout?: () => void;
}

export class NodeLayer {
  private items: NodeMarker[] = [];
  private cutoff = Number.NEGATIVE_INFINITY;
  private hiddenKinds: Set<NodeKind> = new Set();
  private selectedId: string | null = null;
  private sceneActive = false;
  private sceneFocusIds = new Set<string>();
  private map: MlMap;
  private onRequestLayout?: () => void;

  constructor(opts: NodeLayerOptions) {
    this.map = opts.map;
    this.onRequestLayout = opts.onRequestLayout;

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
        <span class="lm-node__label" data-align="left" style="left:calc(50% + 12px);top:50%">${escapeHtml(shortName)}</span>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onSelect(node);
      });
      el.title = `${node.name}（${meta.label}）｜${node.place}${
        node.confidence === 'high' ? '' : '｜史实存疑，点击查看详情'
      }`;
      const labelEl = el.querySelector('.lm-node__label') as HTMLElement;
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(node.coord).addTo(opts.map);
      this.items.push({ node, shortName, marker, el, labelEl, tier });
    }
  }

  setSceneFilter(active: boolean, focusNodeIds: string[] = []) {
    this.sceneActive = active;
    this.sceneFocusIds = new Set(focusNodeIds);
  }

  private isIconVisible(item: NodeMarker, zoom: number): boolean {
    if (this.hiddenKinds.has(item.node.kind)) return false;
    if (item.node.id === this.selectedId) return true;
    if (this.sceneActive && this.sceneFocusIds.has(item.node.id)) return true;
    const maxIconTier = zoom >= 6.75 ? 3 : zoom >= 5.45 ? 2 : 1;
    return item.tier <= maxIconTier;
  }

  /** 第一步：向全局仲裁器登记可见节点圆点，防止其他标签盖住圆点 */
  reserveIcons(arbiter: LabelArbiter) {
    const z = this.map.getZoom();
    const isL1 = z < 5.45;
    for (const item of this.items) {
      const hiddenByKind = this.hiddenKinds.has(item.node.kind);
      const visible = this.isIconVisible(item, z);
      const isFocus = !this.sceneActive || this.sceneFocusIds.has(item.node.id) || item.node.id === this.selectedId;

      item.el.classList.toggle('is-hidden', hiddenByKind);
      item.el.classList.toggle('is-collapsed', !hiddenByKind && !visible);
      item.el.classList.toggle('is-compact', isL1 && item.node.id !== this.selectedId);
      item.el.classList.toggle('is-scene-muted', this.sceneActive && !isFocus);

      if (visible) {
        arbiter.reserveIcon(item.node.coord, isL1 ? 8 : 11);
      } else {
        item.el.classList.remove('is-label-shown');
      }
    }
  }

  /** 第二步（最高优先）：若用户点选了某个节点，优先锁定其标签位置 */
  placeSelected(arbiter: LabelArbiter) {
    if (!this.selectedId) return;
    const item = this.items.find((x) => x.node.id === this.selectedId);
    if (!item || this.hiddenKinds.has(item.node.kind)) return;
    const w = estimateTextWidth(item.shortName, 12, 16);
    const choice = arbiter.placeAroundPoint(item.node.coord, w, 20, { gap: 13, forceIfSelected: true });
    if (choice) {
      this.applyPlacement(item, choice.dx, choice.dy, choice.align);
      item.el.classList.add('is-label-shown');
    }
  }

  /** 第三步：在场景标绘与重镇落位之后，排布符合当前比例尺与场景焦点条件的节点文字 */
  placeLabels(arbiter: LabelArbiter) {
    const z = this.map.getZoom();
    const isL1 = z < 5.45;
    const maxLabelTier = z >= 6.85 ? 3 : z >= 5.9 ? 2 : 1;
    const vw = this.map.getContainer().clientWidth || 1280;

    const candidates: { item: NodeMarker; isFuture: boolean; isSceneFocus: boolean }[] = [];

    for (const item of this.items) {
      if (item.node.id === this.selectedId) continue;
      if (!this.isIconVisible(item, z)) {
        item.el.classList.remove('is-label-shown');
        continue;
      }

      const isSceneFocus = this.sceneActive && this.sceneFocusIds.has(item.node.id);
      let eligible = false;
      if (this.sceneActive) {
        // 战役特写演播中，仅本幕点名的关键节点常显文字，其余一律折叠（悬停可看）
        eligible = isSceneFocus;
      } else if (isL1) {
        eligible = MACRO_LABEL_IDS.has(item.node.id);
      } else {
        eligible = item.tier <= maxLabelTier;
      }

      if (!eligible) {
        item.el.classList.remove('is-label-shown');
        // 为悬停态预设不溢出的默认朝向
        const pt = this.map.project(item.node.coord);
        const hoverLeft = pt.x > vw * 0.72;
        this.applyPlacement(item, hoverLeft ? -12 : 12, 0, hoverLeft ? 'right' : 'left');
        continue;
      }

      candidates.push({
        item,
        isFuture: item.el.classList.contains('is-future'),
        isSceneFocus,
      });
    }

    candidates.sort((a, b) => {
      if (a.isSceneFocus !== b.isSceneFocus) return a.isSceneFocus ? -1 : 1;
      if (a.item.tier !== b.item.tier) return a.item.tier - b.item.tier;
      if (a.isFuture !== b.isFuture) return a.isFuture ? 1 : -1;
      return 0;
    });

    for (const c of candidates) {
      const fontPx = isL1 ? 10.5 : 11.5;
      const w = estimateTextWidth(c.item.shortName, fontPx, 10);
      const choice = arbiter.placeAroundPoint(c.item.node.coord, w, 18, {
        gap: isL1 ? 10 : 12,
        maxRouteHits: c.isSceneFocus ? 2 : 1,
      });
      if (choice) {
        this.applyPlacement(c.item, choice.dx, choice.dy, choice.align);
        c.item.el.classList.add('is-label-shown');
      } else {
        c.item.el.classList.remove('is-label-shown');
      }
    }
  }

  private applyPlacement(
    item: NodeMarker,
    dx: number,
    dy: number,
    align: 'left' | 'right' | 'center-top' | 'center-bottom',
  ) {
    item.labelEl.dataset.align = align;
    item.labelEl.style.left = `calc(50% + ${dx.toFixed(1)}px)`;
    item.labelEl.style.top = `calc(50% + ${dy.toFixed(1)}px)`;
  }

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
    if (changed) this.onRequestLayout?.();
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    for (const item of this.items) {
      item.el.classList.toggle('is-selected', item.node.id === id);
    }
    this.onRequestLayout?.();
  }

  setVisible(kinds: Set<NodeKind>) {
    this.hiddenKinds = new Set((Object.keys(KIND_META) as NodeKind[]).filter((k) => !kinds.has(k)));
    this.onRequestLayout?.();
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
