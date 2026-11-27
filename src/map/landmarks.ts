/**
 * 战略重镇与战术地标图层（接入 LabelArbiter 统一避让，普通地标采用纯净描边字，聚光目标采用轻底衬）。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import { landmarks, type Landmark } from '../data/landmarks';
import { estimateTextWidth, type LabelArbiter } from './labelArbiter';
import { escapeHtml } from './nodes';

export class LandmarkLayer {
  private items: {
    spec: Landmark;
    marker: Marker;
    el: HTMLDivElement;
    bodyEl: HTMLElement;
    noteEl: HTMLElement;
  }[] = [];
  private activeSceneId: string | null = null;
  private highlightedIds: Set<string> = new Set();
  private enabled = true;

  constructor(
    private map: MlMap,
    private onRequestLayout?: () => void,
  ) {
    for (const spec of landmarks) {
      const el = document.createElement('div');
      el.className = `lm-landmark lm-landmark--${spec.tier}`;
      el.innerHTML = `
        <span class="lm-landmark__glyph" aria-hidden="true"></span>
        <span class="lm-landmark__body" data-align="left" style="left:calc(50% + 10px);top:50%">
          <strong class="lm-landmark__name">${escapeHtml(spec.name)}</strong>
          <em class="lm-landmark__note"></em>
        </span>
      `;
      if (spec.brief) el.title = `${spec.name}｜${spec.brief}`;
      const bodyEl = el.querySelector('.lm-landmark__body') as HTMLElement;
      const noteEl = el.querySelector('.lm-landmark__note') as HTMLElement;
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(spec.coord).addTo(this.map);
      this.items.push({ spec, marker, el, bodyEl, noteEl });
    }
  }

  setSceneContext(sceneId: string | null, focusLandmarkIds: string[] = []) {
    this.activeSceneId = sceneId;
    this.highlightedIds = new Set(focusLandmarkIds);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.onRequestLayout?.();
  }

  get isEnabled() {
    return this.enabled;
  }

  private computeVisibility(spec: Landmark, z: number): { visible: boolean; isSpotlight: boolean } {
    if (!this.enabled) return { visible: false, isSpotlight: false };
    const focus = this.activeSceneId ? spec.sceneFocus?.[this.activeSceneId] : undefined;
    const isSpotlight = Boolean(focus && this.highlightedIds.has(spec.id));

    if (this.activeSceneId) {
      // 战役场景演播期间：聚焦本幕点名的战略/战术支点，以及不冲突的省级大重镇
      if (isSpotlight) return { visible: true, isSpotlight: true };
      if (spec.tier === 'strategic' && z >= 5.6) return { visible: true, isSpotlight: false };
      return { visible: false, isSpotlight: false };
    }

    if (spec.tier === 'strategic') return { visible: z >= 5.5, isSpotlight: false };
    return { visible: z >= 6.85, isSpotlight: false };
  }

  reserveIcons(arbiter: LabelArbiter) {
    const z = this.map.getZoom();
    for (const item of this.items) {
      const { visible, isSpotlight } = this.computeVisibility(item.spec, z);
      item.el.classList.toggle('is-hidden', !visible);
      item.el.classList.toggle('is-spotlight', isSpotlight);
      if (visible) {
        arbiter.reserveIcon(item.spec.coord, isSpotlight ? 10 : 7);
      }
    }
  }

  placeLabels(arbiter: LabelArbiter) {
    const z = this.map.getZoom();
    const preferredMap: Record<string, 'left' | 'right' | 'center-top' | 'center-bottom'> = {
      right: 'left',
      left: 'right',
      top: 'center-top',
      bottom: 'center-bottom',
    };

    // 先排聚光重镇（如奇袭贵阳、佯逼昆明、松潘受阻），再排普通参照城池
    const ordered = this.items.slice().sort((a, b) => {
      const sa = a.el.classList.contains('is-spotlight') ? 0 : 1;
      const sb = b.el.classList.contains('is-spotlight') ? 0 : 1;
      return sa - sb;
    });

    for (const item of ordered) {
      const { visible, isSpotlight } = this.computeVisibility(item.spec, z);
      if (!visible) continue;

      const focus = this.activeSceneId ? item.spec.sceneFocus?.[this.activeSceneId] : undefined;
      item.el.dataset.tone = focus ? focus.tone : '';
      const noteText = isSpotlight && focus ? focus.note : '';
      if (item.noteEl.textContent !== noteText) item.noteEl.textContent = noteText;
      item.el.classList.toggle('has-note', Boolean(noteText));

      const nameW = estimateTextWidth(item.spec.name, isSpotlight ? 12 : 11, 8);
      const noteW = noteText ? estimateTextWidth(noteText, 10, 12) : 0;
      const w = Math.max(nameW, noteW);
      const h = noteText ? 32 : 17;

      const choice = arbiter.placeAroundPoint(item.spec.coord, w, h, {
        gap: isSpotlight ? 11 : 8,
        preferred: item.spec.anchor ? preferredMap[item.spec.anchor] : undefined,
        maxRouteHits: isSpotlight ? 2 : 0,
      });

      if (choice) {
        item.bodyEl.dataset.align = choice.align;
        item.bodyEl.style.left = `calc(50% + ${choice.dx.toFixed(1)}px)`;
        item.bodyEl.style.top = `calc(50% + ${choice.dy.toFixed(1)}px)`;
        item.bodyEl.classList.remove('is-folded');
      } else {
        item.bodyEl.classList.add('is-folded');
      }
    }
  }
}
