/**
 * 战役场景编排控制器（SceneDirector）。
 *
 * 核心职责：
 * 1. 将长征主路线（全程常驻不断）与六大核心战役场景融为一体；
 * 2. 随时间轴推进（或用户点选场景/节拍芯片）自动驱动：
 *    - 镜头平滑推入战场沙盘 / 结束后拉回行军走廊（支持人工拖拽自动挂起跟随）；
 *    - 敌我进攻箭头、钳形合击、锯齿防线的 0→1 渐进生长动画与激战脉冲点；
 *    - 高精度战场地形切片（湘江 / 四渡赤水）切换；
 *    - 战略重镇地标跨级聚光高亮（如四渡赤水末段的「贵阳」、巧渡金沙江前的「昆明」、过草地前的「松潘」）；
 * 3. 复用 DOM Marker 池，保证 60fps 推演过程零节点销毁重建抖动。
 */
import { Marker } from 'maplibre-gl';
import type { Map as MlMap } from 'maplibre-gl';
import { CAMPAIGN_SCENES, type CampaignScene, type SceneBeat } from '../data/scenes';
import type { LonLat } from '../data/types';
import type { OverviewEnemyLayer } from '../map/enemyOverview';
import type { LandmarkLayer } from '../map/landmarks';
import { escapeHtml } from '../map/nodes';
import { parseLooseDate, type RouteHead } from '../map/routes';
import {
  buildSituationGeometry,
  clearSituationLayers,
  hydroGeoJSON,
  updateSituationLayers,
} from '../map/situation';

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
  homeBounds: [[number, number], [number, number]];
  homePadding: { top: number; bottom: number; left: number; right: number };
  onSelectBeatDate: (isoDate: string, autoPlay: boolean) => void;
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

  /** 暂停状态下点选场景/节拍时，用本地 2.2s 计时器完整演播 0→1 战术生长动画 */
  private manualRevealRaf = 0;
  private manualRevealProgress: number | null = null;
  private currentBeat: PreparedBeat | null = null;

  /** 复用当前节拍的标签与激战脉冲 DOM 池，60fps 下只改坐标与透明度 */
  private labelPool = new Map<string, { marker: Marker; el: HTMLDivElement }>();
  private clashPool = new Map<string, { marker: Marker; el: HTMLDivElement }>();

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

  /** 供时间轴计算自适应演播速率：进入核心战役节拍时自动放缓，保证每个节拍约有 4.8 秒演播时长 */
  getPlaybackRateFactor(tsMs: number, userSpeed: number): number {
    if (userSpeed >= 4) return 1;
    const hit = this.findBeatAt(tsMs);
    if (!hit) return 1.22; // 非战役长途行军段略微轻快推进
    const beatDays = Math.max(1, (hit.tTo - hit.tFrom) / DAY_MS);
    // 基准 1x 下 743 天 / 58 秒 ≈ 12.8 天/秒；希望单节拍持续约 4.6 秒 → 目标速率 = beatDays / 4.6
    const desiredDaysPerSec = beatDays / 4.6;
    return Math.max(0.14, Math.min(0.85, desiredDaysPerSec / 12.8));
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
    // 监听真实用户手势：拖拽、滚轮或触控缩放地图时立即让出镜头控制权，绝不与用户抢手
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

    // HUD 内部节拍切换、上下一幕与退出按钮委托
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

  /** 外部主动跳转到某个战役场景与节拍（如点击底部芯片、右上角「战役剧场」或节点详情入口） */
  focusScene(sceneId: string, beatIndex = 0, autoPlay = false) {
    const scene = CAMPAIGN_SCENES.find((s) => s.id === sceneId) ?? CAMPAIGN_SCENES[0];
    if (!scene) return;
    const clampedIdx = Math.max(0, Math.min(scene.beats.length - 1, beatIndex));
    const beat = scene.beats[clampedIdx];

    this.followEnabled = true;
    this.userDetached = false;
    this.syncFollowButton();
    this.lastCameraKey = `${scene.id}:${beat.id}`;

    // 启动单幕 0→1 渐进推演动画，即便时间轴处于暂停态也能完整看到敌我态势动态展开
    this.startManualReveal();
    this.opts.onSelectBeatDate(beat.from, autoPlay);

    const cam = beat.camera;
    this.opts.map.flyTo({ center: cam.center, zoom: cam.zoom, duration: 1150, essential: true });
  }

  /** 循环切入当前或下一场核心战役（绑定顶部「战役剧场」按钮） */
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

  /** 返回全国总览小比例尺视野 */
  resetToOverview() {
    this.userDetached = true;
    this.syncFollowButton();
    this.opts.map.fitBounds(this.opts.homeBounds, { padding: this.opts.homePadding, duration: 1050 });
  }

  setPostureVisible(on: boolean) {
    this.postureVisible = on;
    if (!on) {
      this.clearSceneMapArtifacts();
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
    // 加 60 秒容差采用左闭右开区间 [tFrom, tTo)，避免浮点除法精度在相邻节拍零点交界处落回上一拍
    const probe = tsMs + 60000;
    for (const pb of this.preparedBeats) {
      if (probe >= pb.tFrom && probe < pb.tTo) return pb;
    }
    return null;
  }

  /** 时间轴每次日期/毫秒推进时调用 */
  updateAt(tsMs: number, heads: RouteHead[], isPlaying: boolean, speed: number) {
    if (isPlaying && this.manualRevealRaf) {
      cancelAnimationFrame(this.manualRevealRaf);
      this.manualRevealRaf = 0;
      this.manualRevealProgress = null;
    }

    const hit = this.findBeatAt(tsMs);

    // 高亮底部场景芯片
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
        this.clearSceneMapArtifacts();

        // 走出战役场景后，若开启镜头跟随则平缓拉回走廊中景，继续观察红军战略转移主线
        if (this.followEnabled && !this.userDetached && isPlaying) {
          const lead = heads.find((h) => h.status === 'marching') ?? heads[0];
          if (lead) {
            this.opts.map.easeTo({ center: lead.coord, zoom: 5.15, duration: 1300 });
            this.lastCorridorFollowTs = performance.now();
          }
        }
      } else if (this.followEnabled && !this.userDetached && isPlaying) {
        // 长途行军期间每 1.8 秒轻柔跟随主推进点平移，保持主线在视野舒适区
        const nowPerf = performance.now();
        if (nowPerf - this.lastCorridorFollowTs > 1800) {
          const lead = heads.find((h) => h.army.id === 'red1' && h.status === 'marching')
            ?? heads.find((h) => h.status === 'marching');
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

    // 命中战役节拍
    const beatKey = `${hit.scene.id}:${hit.beat.id}`;
    const beatChanged = beatKey !== this.activeBeatKey;
    this.currentBeat = hit;

    if (beatChanged) {
      this.activeBeatKey = beatKey;
      this.resetMarkerPools();
      this.applyDetailTerrain(hit.scene.detailTerrain ?? null);
      this.opts.enemyOverview.setSceneActive(true);
      this.opts.landmarks.setSceneContext(hit.scene.id, hit.beat.focusLandmarks ?? []);
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
    const { scene, beat } = pb;
    const geo = buildSituationGeometry(
      { id: beat.id, date: beat.from, title: beat.title, narrative: beat.caption, graphics: beat.graphics },
      scene.plotScale ?? 1,
      progress,
    );
    updateSituationLayers(this.opts.map, geo, hydroGeoJSON(scene.hydro));

    // 更新战术标签池（复用已有 Marker，避免每帧重建 DOM）
    const seenLabels = new Set<string>();
    geo.labels.forEach((lb, i) => {
      const key = `${lb.side}:${lb.text}:${i}`;
      seenLabels.add(key);
      let item = this.labelPool.get(key);
      if (!item) {
        const el = document.createElement('div');
        el.className = `sit-label sit-label--${
          lb.side === 'red' ? 'red' : lb.side === 'enemy' ? 'enemy' : 'neutral'
        }`;
        el.textContent = lb.text;
        if (lb.size) el.style.fontSize = `${lb.size}px`;
        const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(lb.coord).addTo(this.opts.map);
        item = { marker, el };
        this.labelPool.set(key, item);
      } else {
        item.marker.setLngLat(lb.coord);
      }
      item.el.style.opacity = String((lb.alpha ?? 1).toFixed(2));
      item.el.classList.remove('is-hidden');
    });

    for (const [key, item] of this.labelPool) {
      if (!seenLabels.has(key)) {
        item.el.style.opacity = '0';
        item.el.classList.add('is-hidden');
      }
    }

    // 更新激战脉冲波纹点池
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
          ${cl.label ? `<span class="lm-clash__label">${escapeHtml(cl.label)}</span>` : ''}
        `;
        const marker = new Marker({ element: el, anchor: 'center' }).setLngLat(cl.coord).addTo(this.opts.map);
        item = { marker, el };
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
