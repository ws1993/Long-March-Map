/**
 * 战役场景编排控制器（SceneDirector）：接入全局 LabelArbiter，态势签沿箭头法向两侧避让排布。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import {
  CAMPAIGN_SCENES,
  type CampaignScene,
  type SceneBeat,
  type SceneGeoLabel,
} from '../data/scenes';
import type { LonLat } from '../data/types';
import type { OverviewEnemyLayer } from '../map/enemyOverview';
import { estimateTextWidth, type LabelArbiter } from '../map/labelArbiter';
import type { LandmarkLayer } from '../map/landmarks';
import { escapeHtml, type NodeLayer } from '../map/nodes';
import type { RouteLabelLayer } from '../map/routeLabels';
import { parseLooseDate, type RouteHead } from '../map/routes';
import {
  buildSituationGeometry,
  clearSituationLayers,
  geoZoneFeatures,
  hydroGeoJSON,
  updateSituationLayers,
  type SituationClashPoint,
  type SituationLabelSpec,
} from '../map/situation';

import {
  SPEED_LOCK,
  smoothSpeedLock,
  speedLockTarget,
  type PlaybackRateProfile,
} from './speedLock';

const DAY_MS = 86400000;

interface PreparedBeat {
  scene: CampaignScene;
  beat: SceneBeat;
  beatIndex: number;
  tFrom: number;
  tTo: number;
}

export interface SceneDirectorOptions {
  map: MlMap;
  enemyOverview: OverviewEnemyLayer;
  landmarks: LandmarkLayer;
  nodeLayer: NodeLayer;
  routeLabels: RouteLabelLayer;
  homeBounds: [[number, number], [number, number]];
  homePadding: { top: number; bottom: number; left: number; right: number };
  onSelectBeatDate: (isoDate: string, autoPlay: boolean) => void;
  onRequestLayout: () => void;
}

export class SceneDirector {
  private preparedBeats: PreparedBeat[] = [];
  private detailTerrainNames: string[];

  private hudEl: HTMLElement;
  private stripEl: HTMLElement;
  private followBtn: HTMLButtonElement;

  private followEnabled = true;
  private userDetached = false;
  private postureVisible = true;

  private activeBeatKey: string | null = null;
  private activeSceneId: string | null = null;
  private lastCameraKey: string | null = null;
  private lastCorridorFollowTs = 0;

  private manualRevealRaf = 0;
  private manualRevealProgress: number | null = null;
  private currentBeat: PreparedBeat | null = null;

  /** 比例尺观感补偿因子（逐帧平滑，null 表示尚未初始化） */
  private speedLock: number | null = null;

  private latestLabels: SituationLabelSpec[] = [];
  private latestClashes: SituationClashPoint[] = [];
  private latestGeoLabels: SceneGeoLabel[] = [];

  private labelPool = new Map<string, { marker: Marker; el: HTMLDivElement; txtEl: HTMLElement }>();
  private clashPool = new Map<string, { marker: Marker; el: HTMLDivElement; labelEl: HTMLElement | null }>();
  private sceneGeoPool = new Map<string, { marker: Marker; el: HTMLDivElement; innerEl: HTMLElement }>();

  constructor(private opts: SceneDirectorOptions) {
    this.hudEl = document.getElementById('scene-hud') as HTMLElement;
    this.stripEl = document.getElementById('scene-strip') as HTMLElement;
    this.followBtn = document.getElementById('btn-follow') as HTMLButtonElement;

    for (const scene of CAMPAIGN_SCENES) {
      scene.beats.forEach((beat, beatIndex) => {
        this.preparedBeats.push({
          scene,
          beat,
          beatIndex,
          tFrom: parseLooseDate(beat.from),
          tTo: parseLooseDate(beat.to) + DAY_MS,
        });
      });
    }

    this.detailTerrainNames = [
      ...new Set(CAMPAIGN_SCENES.map((s) => s.detailTerrain).filter((x): x is string => Boolean(x))),
    ];

    this.renderSceneStrip();
    this.bindInteractions();
    this.syncFollowButton();
  }

  /**
   * 计算本帧播放速率剖面。
   * 时间推进速率 = 用户倍速 × profile.time（战役节奏）× profile.lock（比例尺补偿）。
   *
   * lock 把「时间一致」改成「观感一致」：屏幕位移速度 ∝ 世界速度 × 2^zoom，
   * 用 2^(strength·(refZoom − zoom)) 反向抵消，放大则时间自动放慢。
   */
  getPlaybackRateProfile(tsMs: number, userSpeed: number): PlaybackRateProfile {
    return {
      time: this.beatRateFactor(tsMs, userSpeed),
      lock: this.advanceSpeedLock(userSpeed),
    };
  }

  /** 战役节奏压缩：把每个 beat 的历史跨度摊到约 4.6 秒（快速档不压缩） */
  private beatRateFactor(tsMs: number, userSpeed: number): number {
    if (userSpeed >= 4) return 1;
    const hit = this.findBeatAt(tsMs);
    if (!hit) return 1.22;
    const beatDays = Math.max(1, (hit.tTo - hit.tFrom) / DAY_MS);
    const desiredDaysPerSec = beatDays / 4.6;
    return Math.max(0.14, Math.min(0.85, desiredDaysPerSec / 12.8));
  }

  /**
   * 比例尺观感补偿：算出目标因子后做一阶平滑。
   * 参考视野取当前战役的默认相机 zoom，无战役时用全国总览档，
   * 于是每个战役在自己的目标视野下都是 1× 基准手感，用户再放大才会放慢。
   */
  private advanceSpeedLock(userSpeed: number): number {
    const zoom = this.opts.map.getZoom();
    const refZoom = this.currentBeat ? this.currentBeat.beat.camera.zoom : SPEED_LOCK.overviewZoom;
    const strength = userSpeed >= 4 ? SPEED_LOCK.fastTierStrength : SPEED_LOCK.strength;
    this.speedLock = smoothSpeedLock(this.speedLock, speedLockTarget(zoom, refZoom, strength));
    return this.speedLock;
  }

  private renderSceneStrip() {
    this.stripEl.innerHTML = CAMPAIGN_SCENES.map(
      (s) => `
      <button type="button" class="lm-scene-chip" data-scene-id="${s.id}" title="${escapeHtml(s.title)}">
        <span class="lm-scene-chip__num">0${s.index}</span>
        <span>${escapeHtml(s.shortTitle)}</span>
      </button>`,
    ).join('');

    this.stripEl.querySelectorAll<HTMLButtonElement>('.lm-scene-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sceneId ?? '';
        this.focusScene(id, 0, false);
      });
    });
  }

  private bindInteractions() {
    const onUserGesture = (e: { originalEvent?: Event }) => {
      if (!e.originalEvent) return;
      if (this.followEnabled && !this.userDetached) {
        this.userDetached = true;
        this.syncFollowButton();
      }
    };
    this.opts.map.on('dragstart', onUserGesture);
    this.opts.map.on('wheel', onUserGesture);
    this.opts.map.on('touchstart', onUserGesture);

    this.followBtn?.addEventListener('click', () => {
      if (this.userDetached) {
        this.userDetached = false;
        this.followEnabled = true;
        this.syncFollowButton();
        this.reapplyCurrentCamera();
        return;
      }
      this.followEnabled = !this.followEnabled;
      this.userDetached = false;
      this.syncFollowButton();
      if (this.followEnabled) this.reapplyCurrentCamera();
    });

    this.hudEl.addEventListener('click', (e) => {
      const beatBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-beat-idx]');
      if (beatBtn && this.currentBeat) {
        const idx = Number(beatBtn.dataset.beatIdx ?? '0');
        this.focusScene(this.currentBeat.scene.id, idx, false);
        return;
      }
      const navSceneBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-goto-scene]');
      if (navSceneBtn) {
        this.focusScene(navSceneBtn.dataset.gotoScene ?? '', 0, false);
        return;
      }
      if ((e.target as HTMLElement).closest('#scene-hud-overview')) {
        this.resetToOverview();
      }
    });
  }

  private syncFollowButton() {
    if (!this.followBtn) return;
    if (this.userDetached) {
      this.followBtn.textContent = '恢复镜头跟随';
      this.followBtn.className = 'lm-follow-btn is-detached';
    } else if (this.followEnabled) {
      this.followBtn.textContent = '镜头跟随 · 开';
      this.followBtn.className = 'lm-follow-btn is-on';
    } else {
      this.followBtn.textContent = '镜头跟随 · 关';
      this.followBtn.className = 'lm-follow-btn';
    }
  }

  focusScene(sceneId: string, beatIndex = 0, autoPlay = false) {
    const scene = CAMPAIGN_SCENES.find((s) => s.id === sceneId) ?? CAMPAIGN_SCENES[0];
    if (!scene) return;
    const clampedIdx = Math.max(0, Math.min(scene.beats.length - 1, beatIndex));
    const beat = scene.beats[clampedIdx];

    this.followEnabled = true;
    this.userDetached = false;
    this.syncFollowButton();
    this.lastCameraKey = `${scene.id}:${beat.id}`;

    this.startManualReveal();
    this.opts.onSelectBeatDate(beat.from, autoPlay);

    const cam = beat.camera;
    this.opts.map.flyTo({ center: cam.center, zoom: cam.zoom, duration: 1150, essential: true });
  }

  openTheater(preferredSceneId?: string) {
    if (preferredSceneId) {
      this.focusScene(preferredSceneId, 0, false);
      return;
    }
    if (!this.currentBeat) {
      this.focusScene('sc-chishui', 0, false);
      return;
    }
    const curIdx = CAMPAIGN_SCENES.findIndex((s) => s.id === this.currentBeat?.scene.id);
    const next = CAMPAIGN_SCENES[(curIdx + 1) % CAMPAIGN_SCENES.length];
    this.focusScene(next.id, 0, false);
  }

  resetToOverview() {
    this.userDetached = true;
    this.syncFollowButton();
    this.opts.map.fitBounds(this.opts.homeBounds, { padding: this.opts.homePadding, duration: 1050 });
  }

  setPostureVisible(on: boolean) {
    this.postureVisible = on;
    if (!on) {
      this.clearSceneMapArtifacts();
      this.opts.onRequestLayout();
    } else if (this.currentBeat) {
      this.paintBeat(this.currentBeat, this.manualRevealProgress ?? 1);
    }
  }

  private reapplyCurrentCamera() {
    if (this.currentBeat) {
      const cam = this.currentBeat.beat.camera;
      this.opts.map.easeTo({ center: cam.center, zoom: cam.zoom, duration: 950 });
      this.lastCameraKey = `${this.currentBeat.scene.id}:${this.currentBeat.beat.id}`;
    } else {
      this.opts.map.fitBounds(this.opts.homeBounds, { padding: this.opts.homePadding, duration: 950 });
    }
  }

  private startManualReveal() {
    cancelAnimationFrame(this.manualRevealRaf);
    this.manualRevealProgress = 0.02;
    const t0 = performance.now();
    const duration = 2300;
    const loop = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / duration));
      this.manualRevealProgress = k;
      if (this.currentBeat && this.postureVisible) {
        this.paintBeat(this.currentBeat, k);
      }
      if (k < 1) {
        this.manualRevealRaf = requestAnimationFrame(loop);
      } else {
        this.manualRevealRaf = 0;
        this.manualRevealProgress = null;
      }
    };
    this.manualRevealRaf = requestAnimationFrame(loop);
  }

  private findBeatAt(tsMs: number): PreparedBeat | null {
    const probe = tsMs + 60000;
    for (const pb of this.preparedBeats) {
      if (probe >= pb.tFrom && probe < pb.tTo) return pb;
    }
    return null;
  }

  updateAt(tsMs: number, heads: RouteHead[], isPlaying: boolean, speed: number) {
    if (isPlaying && this.manualRevealRaf) {
      cancelAnimationFrame(this.manualRevealRaf);
      this.manualRevealRaf = 0;
      this.manualRevealProgress = null;
    }

    const hit = this.findBeatAt(tsMs);

    if ((hit?.scene.id ?? null) !== this.activeSceneId) {
      this.activeSceneId = hit?.scene.id ?? null;
      this.stripEl.querySelectorAll<HTMLElement>('.lm-scene-chip').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.sceneId === this.activeSceneId);
      });
    }

    if (!hit) {
      if (this.currentBeat) {
        this.currentBeat = null;
        this.activeBeatKey = null;
        this.lastCameraKey = null;
        this.hudEl.classList.remove('is-open');
        this.hudEl.setAttribute('aria-hidden', 'true');
        this.applyDetailTerrain(null);
        this.opts.enemyOverview.setSceneActive(false);
        this.opts.landmarks.setSceneContext(null, []);
        this.opts.nodeLayer.setSceneFilter(false, []);
        this.opts.routeLabels.setSceneActive(false);
        this.clearSceneMapArtifacts();
        this.opts.onRequestLayout();

        if (this.followEnabled && !this.userDetached && isPlaying) {
          const lead = heads.find((h) => h.status === 'marching') ?? heads[0];
          if (lead) {
            this.opts.map.easeTo({ center: lead.coord, zoom: 5.15, duration: 1300 });
            this.lastCorridorFollowTs = performance.now();
          }
        }
      } else if (this.followEnabled && !this.userDetached && isPlaying) {
        const nowPerf = performance.now();
        if (nowPerf - this.lastCorridorFollowTs > 1800) {
          const lead =
            heads.find((h) => h.army.id === 'red1' && h.status === 'marching') ??
            heads.find((h) => h.status === 'marching');
          if (lead) {
            this.opts.map.easeTo({
              center: lead.coord,
              zoom: Math.min(Math.max(this.opts.map.getZoom(), 4.85), 5.35),
              duration: 1600,
            });
            this.lastCorridorFollowTs = nowPerf;
          }
        }
      }
      return;
    }

    const beatKey = `${hit.scene.id}:${hit.beat.id}`;
    const beatChanged = beatKey !== this.activeBeatKey;
    this.currentBeat = hit;

    if (beatChanged) {
      this.activeBeatKey = beatKey;
      this.resetMarkerPools();
      this.applyDetailTerrain(hit.scene.detailTerrain ?? null);
      this.opts.enemyOverview.setSceneActive(true);
      this.opts.landmarks.setSceneContext(hit.scene.id, hit.beat.focusLandmarks ?? []);
      this.opts.nodeLayer.setSceneFilter(true, hit.beat.focusNodes ?? []);
      this.opts.routeLabels.setSceneActive(true);
      this.renderHud(hit);

      if (this.followEnabled && !this.userDetached && this.lastCameraKey !== beatKey) {
        const cam = hit.beat.camera;
        const targetZoom = speed >= 4 ? Math.min(cam.zoom, 6.15) : cam.zoom;
        this.opts.map.easeTo({
          center: cam.center,
          zoom: targetZoom,
          duration: speed >= 4 ? 750 : 1150,
          essential: true,
        });
        this.lastCameraKey = beatKey;
      }
    }

    const span = Math.max(1, hit.tTo - hit.tFrom);
    const timelineProgress = Math.max(0.08, Math.min(1, (tsMs - hit.tFrom) / (span * 0.86)));
    const effProgress = this.manualRevealProgress !== null ? this.manualRevealProgress : timelineProgress;

    this.updateHudProgress(hit, Math.max(0, Math.min(1, (tsMs - hit.tFrom) / span)));
    if (this.postureVisible) {
      this.paintBeat(hit, effProgress);
    }
  }

  private renderHud(pb: PreparedBeat) {
    const { scene, beat, beatIndex } = pb;
    const prevScene = CAMPAIGN_SCENES[scene.index - 2];
    const nextScene = CAMPAIGN_SCENES[scene.index];

    const stepsHtml = scene.beats
      .map(
        (b, idx) => `
        <button
          type="button"
          class="sc-hud__step${idx === beatIndex ? ' is-on' : ''}"
          data-beat-idx="${idx}"
          title="${escapeHtml(b.title)}"
        >
          <span class="sc-hud__step-bar"></span>
          <span class="sc-hud__step-txt">${idx + 1}. ${escapeHtml(b.title.split(' · ')[0])}</span>
        </button>`,
      )
      .join('');

    this.hudEl.innerHTML = `
      <div class="sc-hud__top">
        <span class="sc-hud__badge">战役剧场 0${scene.index} / 0${CAMPAIGN_SCENES.length}</span>
        <div class="sc-hud__top-actions">
          ${
            prevScene
              ? `<button type="button" class="sc-hud__mini" data-goto-scene="${prevScene.id}" title="上一战役：${escapeHtml(prevScene.shortTitle)}">‹ 上一役</button>`
              : ''
          }
          ${
            nextScene
              ? `<button type="button" class="sc-hud__mini" data-goto-scene="${nextScene.id}" title="下一战役：${escapeHtml(nextScene.shortTitle)}">下一役 ›</button>`
              : ''
          }
          <button type="button" class="sc-hud__mini" id="scene-hud-overview" title="缩回全国战略总览">全局视野</button>
        </div>
      </div>
      <h2 class="sc-hud__title">${escapeHtml(scene.title)}</h2>
      <div class="sc-hud__forces">
        <div class="sc-force sc-force--red">
          <span>${escapeHtml(scene.redSide.name)}</span>
          <strong>${escapeHtml(scene.redSide.strength)}</strong>
        </div>
        <span class="sc-hud__vs">VS</span>
        <div class="sc-force sc-force--enemy">
          <span>${escapeHtml(scene.enemySide.name)}</span>
          <strong>${escapeHtml(scene.enemySide.strength)}</strong>
        </div>
      </div>
      <div class="sc-hud__steps">${stepsHtml}</div>
      <div class="sc-hud__beat">
        <div class="sc-hud__beat-head">
          <span class="sc-hud__date">${escapeHtml(beat.dateLabel)}</span>
          <strong>${escapeHtml(beat.title)}</strong>
        </div>
        <p class="sc-hud__caption">${escapeHtml(beat.caption)}</p>
      </div>
    `;
    this.hudEl.classList.add('is-open');
    this.hudEl.setAttribute('aria-hidden', 'false');
  }

  private updateHudProgress(pb: PreparedBeat, ratio: number) {
    const activeBar = this.hudEl.querySelector<HTMLElement>(
      `.sc-hud__step[data-beat-idx="${pb.beatIndex}"] .sc-hud__step-bar`,
    );
    if (activeBar) {
      activeBar.style.transform = `scaleX(${ratio.toFixed(3)})`;
    }
  }

  private paintBeat(pb: PreparedBeat, progress: number) {
    const { scene, beat, beatIndex } = pb;
    const geo = buildSituationGeometry(
      { id: beat.id, date: beat.from, title: beat.title, narrative: beat.caption, graphics: beat.graphics },
      scene.plotScale ?? 1,
      progress,
    );
    const activeZones = (scene.geoZones ?? []).filter(
      (z) => !z.beats || z.beats.includes(beatIndex),
    );
    updateSituationLayers(
      this.opts.map,
      geo,
      hydroGeoJSON(scene.hydro, scene.primaryHydro),
      geoZoneFeatures(activeZones),
    );

    this.latestLabels = geo.labels;
    this.latestClashes = geo.clashes;
    this.latestGeoLabels = (scene.geoLabels ?? []).filter(
      (g) => !g.beats || g.beats.includes(beatIndex),
    );

    // 同步战役专属地理地物标签池（河流、山脉、草地沼泽）
    const seenGeo = new Set<string>();
    const GEO_GLYPH: Record<SceneGeoLabel['kind'], string> = {
      river: '≈',
      mountain: '▲',
      marsh: '❖',
    };
    for (const gl of this.latestGeoLabels) {
      seenGeo.add(gl.id);
      let gItem = this.sceneGeoPool.get(gl.id);
      if (!gItem) {
        const el = document.createElement('div');
        el.className = `lm-sc-geo lm-sc-geo--${gl.kind}`;
        const innerEl = document.createElement('span');
        innerEl.className = 'lm-sc-geo__inner';
        innerEl.innerHTML = `<i aria-hidden="true">${GEO_GLYPH[gl.kind]}</i>${escapeHtml(gl.name)}`;
        if (gl.rotate) innerEl.style.setProperty('--geo-rot', `${gl.rotate}deg`);
        el.appendChild(innerEl);
        const marker = new Marker({ element: el, anchor: 'center' })
          .setLngLat(gl.coords[0])
          .addTo(this.opts.map);
        gItem = { marker, el, innerEl };
        this.sceneGeoPool.set(gl.id, gItem);
      }
    }
    for (const [key, gItem] of this.sceneGeoPool) {
      if (!seenGeo.has(key)) {
        gItem.el.classList.add('is-hidden');
      }
    }

    // 同步 DOM 池元素坐标，交由统一仲裁器决定偏置方向与显隐
    const seenLabels = new Set<string>();
    for (const lb of geo.labels) {
      seenLabels.add(lb.id);
      let item = this.labelPool.get(lb.id);
      if (!item) {
        const el = document.createElement('div');
        el.className = `sit-label sit-label--${
          lb.side === 'red' ? 'red' : lb.side === 'enemy' ? 'enemy' : 'neutral'
        }`;
        const txtEl = document.createElement('span');
        txtEl.className = 'sit-label__txt';
        txtEl.dataset.align = 'left';
        txtEl.textContent = lb.text;
        if (lb.size) txtEl.style.fontSize = `${lb.size}px`;
        el.appendChild(txtEl);
        const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(lb.coord).addTo(this.opts.map);
        item = { marker, el, txtEl };
        this.labelPool.set(lb.id, item);
      } else {
        item.marker.setLngLat(lb.coord);
      }
      item.el.dataset.baseAlpha = String((lb.alpha ?? 1).toFixed(2));
    }

    for (const [key, item] of this.labelPool) {
      if (!seenLabels.has(key)) {
        item.el.style.opacity = '0';
        item.el.classList.add('is-hidden');
      }
    }

    const seenClashes = new Set<string>();
    for (const cl of geo.clashes) {
      seenClashes.add(cl.id);
      let item = this.clashPool.get(cl.id);
      if (!item) {
        const el = document.createElement('div');
        el.className = `lm-clash lm-clash--${cl.side}`;
        el.innerHTML = `
          <span class="lm-clash__ring" aria-hidden="true"></span>
          <span class="lm-clash__core" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor"/></svg>
          </span>
          ${cl.label ? `<span class="lm-clash__label" data-align="center-bottom">${escapeHtml(cl.label)}</span>` : ''}
        `;
        const labelEl = el.querySelector<HTMLElement>('.lm-clash__label');
        const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(cl.coord).addTo(this.opts.map);
        item = { marker, el, labelEl };
        this.clashPool.set(cl.id, item);
      } else {
        item.marker.setLngLat(cl.coord);
      }
      item.el.style.opacity = String(cl.alpha.toFixed(2));
      item.el.classList.remove('is-hidden');
    }

    for (const [key, item] of this.clashPool) {
      if (!seenClashes.has(key)) {
        item.el.style.opacity = '0';
        item.el.classList.add('is-hidden');
      }
    }

    this.opts.onRequestLayout();
  }

  /** 向全局仲裁器登记激战核心图标 */
  reserveIcons(arbiter: LabelArbiter) {
    if (!this.currentBeat || !this.postureVisible) return;
    for (const cl of this.latestClashes) {
      arbiter.reserveIcon(cl.coord, 13);
    }
  }

  /** 在全局仲裁器中排布激战标签、主角山川水系注记与箭头侧翼态势签 */
  placeLabels(arbiter: LabelArbiter) {
    if (!this.currentBeat || !this.postureVisible) return;

    for (const cl of this.latestClashes) {
      const item = this.clashPool.get(cl.id);
      if (!item || !item.labelEl || !cl.label) continue;
      const w = estimateTextWidth(cl.label, 10.5, 10);
      const choice = arbiter.placeAroundPoint(cl.coord, w, 17, {
        gap: 15,
        preferred: 'center-bottom',
        maxRouteHits: 2,
      });
      if (choice) {
        item.labelEl.dataset.align = choice.align;
        item.labelEl.style.left = `calc(50% + ${choice.dx.toFixed(1)}px)`;
        item.labelEl.style.top = `calc(50% + ${choice.dy.toFixed(1)}px)`;
        item.labelEl.style.display = 'block';
      } else {
        item.labelEl.style.display = 'none';
      }
    }

    // 先锁定本幕主角地理地物（列表首项如赤水河、湘江、金沙江、大渡河、松潘草地、乌蒙山脉），让箭头番号自动绕开河名
    const placeOneGeo = (gl: SceneGeoLabel) => {
      const gItem = this.sceneGeoPool.get(gl.id);
      if (!gItem) return;
      const w = estimateTextWidth(gl.name, 12, 22);
      let placed = false;
      for (const candidateCoord of gl.coords) {
        const choice = arbiter.placeAroundPoint(candidateCoord, w, 19, {
          gap: 4,
          preferred: 'center-top',
          maxRouteHits: 3,
        });
        if (choice) {
          gItem.marker.setLngLat(candidateCoord);
          gItem.innerEl.dataset.align = choice.align;
          gItem.innerEl.style.left = `${choice.dx.toFixed(1)}px`;
          gItem.innerEl.style.top = `${choice.dy.toFixed(1)}px`;
          gItem.el.classList.remove('is-hidden');
          placed = true;
          break;
        }
      }
      if (!placed) {
        gItem.el.classList.add('is-hidden');
      }
    };

    const primaryGeos = this.latestGeoLabels.slice(0, 2);
    const secondaryGeos = this.latestGeoLabels.slice(2);
    for (const gl of primaryGeos) placeOneGeo(gl);

    for (const lb of this.latestLabels) {
      const item = this.labelPool.get(lb.id);
      if (!item) continue;
      const w = estimateTextWidth(lb.text, lb.size ?? 11, 8);
      const choice = lb.tangentTo
        ? arbiter.placeAlongsideVector(lb.coord, lb.tangentTo, w, 17, 15)
        : arbiter.placeAroundPoint(lb.coord, w, 17, { gap: 10 });

      if (choice) {
        item.txtEl.dataset.align = choice.align;
        item.txtEl.style.left = `${choice.dx.toFixed(1)}px`;
        item.txtEl.style.top = `${choice.dy.toFixed(1)}px`;
        item.el.style.opacity = item.el.dataset.baseAlpha ?? '1';
        item.el.classList.remove('is-hidden');
      } else {
        item.el.style.opacity = '0';
        item.el.classList.add('is-hidden');
      }
    }

    for (const gl of secondaryGeos) placeOneGeo(gl);
  }

  private applyDetailTerrain(active: string | null) {
    for (const name of this.detailTerrainNames) {
      const id = `detail-${name}-layer`;
      if (this.opts.map.getLayer(id)) {
        this.opts.map.setLayoutProperty(id, 'visibility', name === active ? 'visible' : 'none');
      }
    }
  }

  private resetMarkerPools() {
    for (const item of this.labelPool.values()) item.marker.remove();
    this.labelPool.clear();
    for (const item of this.clashPool.values()) item.marker.remove();
    this.clashPool.clear();
    for (const item of this.sceneGeoPool.values()) item.marker.remove();
    this.sceneGeoPool.clear();
    this.latestLabels = [];
    this.latestClashes = [];
    this.latestGeoLabels = [];
  }

  private clearSceneMapArtifacts() {
    this.resetMarkerPools();
    clearSituationLayers(this.opts.map);
  }

  get isInScene(): boolean {
    return this.currentBeat !== null;
  }
}

export { type LonLat };
