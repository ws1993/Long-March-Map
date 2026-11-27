/**
 * 战略重镇与战术地标图层（DOM Marker，受三级比例尺 LOD 与当前激活战役场景双重控制）。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import { landmarks, type Landmark } from '../data/landmarks';
import { escapeHtml } from './nodes';

export class LandmarkLayer {
  private items: {
    spec: Landmark;
    marker: Marker;
    el: HTMLDivElement;
    noteEl: HTMLElement;
  }[] = [];
  private activeSceneId: string | null = null;
  private highlightedIds: Set<string> = new Set();
  private enabled = true;

  constructor(private map: MlMap) {
    for (const spec of landmarks) {
      const el = document.createElement('div');
      el.className = `lm-landmark lm-landmark--${spec.tier} lm-landmark--anchor-${spec.anchor ?? 'right'}`;
      el.innerHTML = `
        <span class="lm-landmark__glyph" aria-hidden="true"></span>
        <span class="lm-landmark__body">
          <strong class="lm-landmark__name">${escapeHtml(spec.name)}</strong>
          <em class="lm-landmark__note"></em>
        </span>
      `;
      if (spec.brief) el.title = `${spec.name}｜${spec.brief}`;
      const noteEl = el.querySelector('.lm-landmark__note') as HTMLElement;
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(spec.coord).addTo(this.map);
      this.items.push({ spec, marker, el, noteEl });
    }

    this.refresh();
    this.map.on('zoom', () => this.refresh());
  }

  /** 由场景编排器更新当前所处战役场景及本阶段重点点名的地标 ID */
  setSceneContext(sceneId: string | null, focusLandmarkIds: string[] = []) {
    this.activeSceneId = sceneId;
    this.highlightedIds = new Set(focusLandmarkIds);
    this.refresh();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.refresh();
  }

  get isEnabled() {
    return this.enabled;
  }

  private refresh() {
    const z = this.map.getZoom();

    for (const item of this.items) {
      const { spec, el, noteEl } = item;
      const focus = this.activeSceneId ? spec.sceneFocus?.[this.activeSceneId] : undefined;
      const isSpotlight = Boolean(focus && (this.highlightedIds.size === 0 || this.highlightedIds.has(spec.id)));

      // 三级比例尺控制：
      // L1 (z < 5.45): 默认全部隐藏，保持全国总览干净；仅当前正在演播的战役特写点名的地标可跨级显示
      // L2 (5.45 <= z < 6.75): 显示战略重镇（贵阳、昆明、泸州、宜宾、松潘等）+ 当前战役关联战术点
      // L3 (z >= 6.75): 战略重镇与战术渡口要隘全部显示
      let visible = false;
      if (this.enabled) {
        if (isSpotlight) {
          visible = z >= 4.9;
        } else if (focus) {
          visible = z >= 5.35;
        } else if (spec.tier === 'strategic') {
          visible = z >= 5.45;
        } else {
          visible = z >= 6.75;
        }
      }

      el.classList.toggle('is-hidden', !visible);
      el.classList.toggle('is-spotlight', isSpotlight);
      el.dataset.tone = focus ? focus.tone : '';

      const nextNote = isSpotlight && focus ? focus.note : '';
      if (noteEl.textContent !== nextNote) {
        noteEl.textContent = nextNote;
      }
      el.classList.toggle('has-note', Boolean(nextNote));
    }
  }
}
