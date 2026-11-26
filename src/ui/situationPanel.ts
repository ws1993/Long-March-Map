/**
 * 态势面板控制器：战役切换、阶段切换、图文叙述、部队番号标签。
 *
 * 结构：顶部是战役 tab（数据来自 situationBundles）+ 双方兵力对比，
 * 左侧是当前战役的阶段列表，右下角是当前阶段的叙述卡片。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import type { SituationBundle } from '../data/situations';
import { buildSituationGeometry, hydroGeoJSON, updateSituationLayers } from '../map/situation';
import { escapeHtml } from '../map/nodes';

export class SituationPanel {
  private bundleIndex = 0;
  private phaseIndex = 0;
  private labelMarkers: Marker[] = [];
  private root: HTMLElement;
  private stepBox: HTMLElement;
  private cardBox: HTMLElement;
  private tabsBox: HTMLElement;
  private detailNames: string[];

  constructor(
    private map: MlMap,
    private bundles: SituationBundle[],
    private onExit: () => void,
  ) {
    this.root = document.getElementById('situation') as HTMLElement;
    this.stepBox = document.getElementById('sit-steps') as HTMLElement;
    this.cardBox = document.getElementById('sit-card') as HTMLElement;

    // 战役切换 tab 插在「返回总览」之后
    this.tabsBox = document.createElement('div');
    this.tabsBox.className = 'sit-tabs';
    const bar = this.root.querySelector('.lm-situation__bar') as HTMLElement;
    const back = bar.querySelector('#sit-back') as HTMLElement;
    back.insertAdjacentElement('afterend', this.tabsBox);

    this.detailNames = [
      ...new Set(bundles.map((b) => b.situation.detailTerrain).filter((x): x is string => Boolean(x))),
    ];
    this.renderTabs();
    document.getElementById('sit-back')?.addEventListener('click', () => this.onExit());
  }

  private get bundle(): SituationBundle {
    return this.bundles[this.bundleIndex];
  }

  private renderTabs() {
    this.tabsBox.innerHTML = this.bundles
      .map(
        (b, i) => `
        <button class="sit-tab${i === this.bundleIndex ? ' is-on' : ''}" type="button" data-i="${i}">
          ${escapeHtml(b.shortLabel)}
        </button>`,
      )
      .join('');
    this.tabsBox.querySelectorAll<HTMLButtonElement>('.sit-tab').forEach((btn) => {
      btn.addEventListener('click', () => this.setBundle(Number(btn.dataset.i)));
    });
  }

  private renderHeader() {
    const s = this.bundle.situation;
    (document.getElementById('sit-title') as HTMLElement).textContent = s.title;
    (document.getElementById('sit-subtitle') as HTMLElement).textContent = s.subtitle;
    const sides = document.getElementById('sit-sides') as HTMLElement;
    sides.innerHTML = s.sides
      .map(
        (x) => `
        <div class="sit-side sit-side--${x.id === 'red' ? 'red' : 'enemy'}">
          <div class="sit-side__name">${escapeHtml(x.name)}</div>
          <div class="sit-side__strength">${escapeHtml(x.strength)}</div>
          <div class="sit-side__cmd">${escapeHtml(x.commander)}</div>
        </div>`,
      )
      .join('');
  }

  private renderSteps() {
    const s = this.bundle.situation;
    this.stepBox.innerHTML = s.phases
      .map(
        (p, i) => `
        <button class="sit-step${i === 0 ? ' is-on' : ''}" type="button" data-i="${i}">
          <div class="sit-step__date">${escapeHtml(p.date)}</div>
          <div class="sit-step__title">${escapeHtml(p.title)}</div>
        </button>`,
      )
      .join('');
    this.stepBox.querySelectorAll<HTMLButtonElement>('.sit-step').forEach((btn) => {
      btn.addEventListener('click', () => this.gotoPhase(Number(btn.dataset.i)));
    });
  }

  private renderCard() {
    const s = this.bundle.situation;
    const p = s.phases[this.phaseIndex];
    const paras = p.narrative
      .split('\n\n')
      .map((t) => `<p>${escapeHtml(t)}</p>`)
      .join('');
    const last = s.phases.length - 1;
    this.cardBox.innerHTML = `
      <div class="sit-card__kicker">第 ${this.phaseIndex + 1} / ${s.phases.length} 阶段 · ${escapeHtml(p.date)}</div>
      <h3 class="sit-card__title">${escapeHtml(p.title)}</h3>
      <div class="sit-card__text">${paras}</div>
      <div class="sit-card__nav">
        <button type="button" id="sit-prev" ${this.phaseIndex === 0 ? 'disabled' : ''}>← 上一阶段</button>
        <button type="button" id="sit-next" ${this.phaseIndex === last ? 'disabled' : ''}>下一阶段 →</button>
      </div>
    `;
    this.cardBox.querySelector('#sit-prev')?.addEventListener('click', () => this.gotoPhase(this.phaseIndex - 1));
    this.cardBox.querySelector('#sit-next')?.addEventListener('click', () => this.gotoPhase(this.phaseIndex + 1));
  }

  private clearLabels() {
    for (const m of this.labelMarkers) m.remove();
    this.labelMarkers = [];
  }

  /** 切换战场级地形：只让当前战役的那张 detail 底图可见 */
  private applyDetailTerrain(active: string | null) {
    for (const name of this.detailNames) {
      const id = `detail-${name}-layer`;
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', name === active ? 'visible' : 'none');
      }
    }
  }

  /** 切换战役：重建头部、阶段列表、相机与标绘 */
  setBundle(i: number) {
    const idx = Math.max(0, Math.min(this.bundles.length - 1, i));
    this.bundleIndex = idx;
    this.tabsBox.querySelectorAll<HTMLButtonElement>('.sit-tab').forEach((btn, k) => {
      btn.classList.toggle('is-on', k === idx);
    });
    this.renderHeader();
    this.renderSteps();
    this.phaseIndex = 0;
    this.renderCard();
    this.applyDetailTerrain(this.bundle.situation.detailTerrain ?? null);
    this.paint();
    const cam = this.bundle.situation.camera;
    this.map.flyTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch ?? 0, duration: 1000 });
  }

  gotoPhase(i: number) {
    const s = this.bundle.situation;
    const idx = Math.max(0, Math.min(s.phases.length - 1, i));
    this.phaseIndex = idx;
    this.stepBox.querySelectorAll<HTMLButtonElement>('.sit-step').forEach((btn, k) => {
      btn.classList.toggle('is-on', k === idx);
    });
    this.renderCard();
    this.paint();
  }

  private paint() {
    const s = this.bundle.situation;
    const phase = s.phases[this.phaseIndex];
    const geo = buildSituationGeometry(phase, s.plotScale ?? 1);
    updateSituationLayers(this.map, geo, hydroGeoJSON(this.bundle.hydro));

    this.clearLabels();
    const placeLabels = (s.mapLabels ?? []).map((l) => ({
      coord: l.coord,
      text: l.text,
      side: 'neutral' as const,
      size: 12,
    }));
    for (const lb of [...placeLabels, ...geo.labels]) {
      const el = document.createElement('div');
      el.className = `sit-label sit-label--${
        lb.side === 'red' ? 'red' : lb.side === 'enemy' ? 'enemy' : 'neutral'
      }`;
      el.textContent = lb.text;
      if (lb.size) el.style.fontSize = `${lb.size}px`;
      const m = new Marker({ element: el, anchor: 'center' }).setLngLat(lb.coord).addTo(this.map);
      this.labelMarkers.push(m);
    }
  }

  /** 打开态势模式；传入 bundleIndex 可直达某场战役 */
  open(bundleIndex = 0) {
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.bundleIndex = Math.max(0, Math.min(this.bundles.length - 1, bundleIndex));
    this.tabsBox.querySelectorAll<HTMLButtonElement>('.sit-tab').forEach((btn, k) => {
      btn.classList.toggle('is-on', k === this.bundleIndex);
    });
    this.renderHeader();
    this.renderSteps();
    this.phaseIndex = 0;
    this.renderCard();
    this.applyDetailTerrain(this.bundle.situation.detailTerrain ?? null);
    const cam = this.bundle.situation.camera;
    this.map.flyTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch ?? 0, duration: 1100 });
    this.paint();
  }

  close() {
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.applyDetailTerrain(null);
    this.clearLabels();
    updateSituationLayers(
      this.map,
      { polygons: { type: 'FeatureCollection', features: [] }, lines: { type: 'FeatureCollection', features: [] }, labels: [] },
      { type: 'FeatureCollection', features: [] },
    );
  }

  get isOpen() {
    return this.root.classList.contains('is-open');
  }

  get currentBundleIndex() {
    return this.bundleIndex;
  }
}
