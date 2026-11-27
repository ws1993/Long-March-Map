/**
 * 应用主入口：统一调度路线主轴、三级比例尺控量、全局防压盖仲裁器（LabelArbiter）与六大战役动态剧场。
 */
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import './style.css';

import { armies } from './data/armies';
import { centralRedNodes } from './data/nodes-central';
import { otherNodes } from './data/nodes-others';
import { routeSegments } from './data/routes';
import { CAMPAIGN_SCENES } from './data/scenes';
import type { NodeKind, StoryNode } from './data/types';
import { buildBaseStyle, loadDetailTerrains, loadTerrainMeta } from './map/basemap';
import { OverviewEnemyLayer } from './map/enemyOverview';
import { LabelArbiter } from './map/labelArbiter';
import { LandmarkLayer } from './map/landmarks';
import { KIND_META, NodeLayer } from './map/nodes';
import { RouteLabelLayer } from './map/routeLabels';
import {
  addRouteLayers,
  onRouteHeadsChange,
  parseLooseDate,
  setRouteArmyFilter,
  startRouteFlow,
  updateRouteLayers,
  type RouteHead,
} from './map/routes';
import { addSituationLayers } from './map/situation';
import { renderAbout, renderNodeDetail } from './ui/detail';
import { SceneDirector } from './ui/sceneDirector';
import { Timeline } from './ui/timeline';

const allNodes: StoryNode[] = [...centralRedNodes, ...otherNodes].sort((a, b) => a.date.localeCompare(b.date));

const HOME_BOUNDS: [[number, number], [number, number]] = [
  [98.2, 24.2],
  [117.2, 38.2],
];
const HOME_PADDING = { top: 118, bottom: 196, left: 52, right: 52 };

async function boot() {
  const appEl = document.getElementById('app') as HTMLElement;
  const scalePill = document.getElementById('scale-pill') as HTMLElement;
  const loading = document.getElementById('loading') as HTMLElement;

  const terrain = await loadTerrainMeta();
  const detailNames = [
    ...new Set(CAMPAIGN_SCENES.map((s) => s.detailTerrain).filter((x): x is string => Boolean(x))),
  ];
  const details = await loadDetailTerrains(detailNames);

  const map = new maplibregl.Map({
    container: 'map',
    style: buildBaseStyle(terrain, details),
    center: [107, 31],
    zoom: 4.6,
    minZoom: 3.4,
    maxZoom: 12,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 110 }), 'bottom-left');

  await new Promise<void>((resolve) => map.on('load', () => resolve()));

  function syncScaleTier() {
    const z = map.getZoom();
    const tier = z < 5.45 ? 'l1' : z < 6.75 ? 'l2' : 'l3';
    if (appEl.dataset.scale !== tier) appEl.dataset.scale = tier;
    if (scalePill) {
      scalePill.textContent =
        tier === 'l1'
          ? '小比例尺 · 全国总览（精简留白）'
          : tier === 'l2'
            ? '中比例尺 · 战区与战略重镇'
            : '大比例尺 · 战役战术沙盘';
    }
  }

  // ---------------------------------------------------------------- 图层与全局防压盖仲裁器
  addRouteLayers(map);
  const enemyOverview = new OverviewEnemyLayer(map);
  addSituationLayers(map);

  const arbiter = new LabelArbiter(map);
  let layoutRaf = 0;

  let landmarks!: LandmarkLayer;
  let routeLabels!: RouteLabelLayer;
  let nodeLayer!: NodeLayer;
  let sceneDirector!: SceneDirector;

  function runGlobalLayout() {
    layoutRaf = 0;
    if (!landmarks || !routeLabels || !nodeLayer || !sceneDirector) return;
    arbiter.beginPass();

    // 1. 先锁定全部可见图标点位，禁止任何文字盖住图标圆点
    sceneDirector.reserveIcons(arbiter);
    landmarks.reserveIcons(arbiter);
    nodeLayer.reserveIcons(arbiter);

    // 2. 按视觉优先级依次择空落位（并自动避开红军路线采样带）
    nodeLayer.placeSelected(arbiter);
    landmarks.placeLabels(arbiter);
    sceneDirector.placeLabels(arbiter);
    nodeLayer.placeLabels(arbiter);
    routeLabels.placeLabels(arbiter);
  }

  function scheduleLayout() {
    if (layoutRaf) return;
    layoutRaf = requestAnimationFrame(runGlobalLayout);
  }

  landmarks = new LandmarkLayer(map, scheduleLayout);
  routeLabels = new RouteLabelLayer(map, scheduleLayout);
  nodeLayer = new NodeLayer({
    map,
    nodes: allNodes,
    onSelect: (node) => openDetail(node),
    onRequestLayout: scheduleLayout,
  });

  let latestHeads: RouteHead[] = [];
  onRouteHeadsChange((heads) => {
    latestHeads = heads;
    routeLabels.updateHeads(heads);
  });

  syncScaleTier();
  map.on('zoom', () => {
    syncScaleTier();
    scheduleLayout();
  });
  map.on('move', scheduleLayout);

  // ---------------------------------------------------------------- 场景编排器与时间轴
  let timeline!: Timeline;

  sceneDirector = new SceneDirector({
    map,
    enemyOverview,
    landmarks,
    nodeLayer,
    routeLabels,
    homeBounds: HOME_BOUNDS,
    homePadding: HOME_PADDING,
    onSelectBeatDate: (isoDate, autoPlay) => {
      closeDetail();
      timeline.setDate(isoDate, true);
      if (autoPlay && !timeline.isPlaying) timeline.play();
    },
    onRequestLayout: scheduleLayout,
  });

  timeline = new Timeline({
    start: '1934-10-10',
    end: '1936-10-22',
    markers: allNodes,
    durationSeconds: 58,
    rateFactorAt: (tsMs, speed) => sceneDirector.getPlaybackRateFactor(tsMs, speed),
    onDate: (iso, tsMs, meta) => {
      updateRouteLayers(map, tsMs, Boolean(meta.jump));
      enemyOverview.setDate(tsMs);
      nodeLayer.setDateCutoff(iso);
      sceneDirector.updateAt(
        tsMs,
        latestHeads,
        timeline ? timeline.isPlaying : false,
        timeline ? timeline.currentSpeed : 1,
      );
      scheduleLayout();
    },
  });

  const initTs = parseLooseDate(timeline.currentDate);
  updateRouteLayers(map, initTs, false);
  enemyOverview.setDate(initTs);
  nodeLayer.setDateCutoff(timeline.currentDate);
  sceneDirector.updateAt(initTs, latestHeads, false, 1);
  runGlobalLayout();

  const stopFlow = startRouteFlow(map);

  // ---------------------------------------------------------------- 详情抽屉
  const detail = document.getElementById('detail') as HTMLElement;
  const detailBody = document.getElementById('detail-body') as HTMLElement;
  let selectedId: string | null = null;

  function openDetail(node: StoryNode) {
    selectedId = node.id;
    detailBody.innerHTML = renderNodeDetail(node);
    detail.classList.add('is-open');
    detail.setAttribute('aria-hidden', 'false');
    detail.scrollTop = 0;
    nodeLayer.setSelected(node.id);
    timeline.setDate(node.date, true);

    const offset = window.innerWidth > 760 ? -215 : 0;
    map.flyTo({
      center: node.coord,
      zoom: Math.max(map.getZoom(), 6.4),
      offset: [offset, 60],
      duration: 900,
    });
  }

  function closeDetail() {
    selectedId = null;
    detail.classList.remove('is-open');
    detail.setAttribute('aria-hidden', 'true');
    nodeLayer.setSelected(null);
  }

  detailBody.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.dt-sit-jump');
    if (!btn) return;
    const sceneId = btn.dataset.sceneId ?? '';
    const beatIdx = Number(btn.dataset.beatIdx ?? '0');
    sceneDirector.focusScene(sceneId, beatIdx, false);
  });

  document.getElementById('detail-close')?.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetail();
      about.classList.remove('is-open');
      if (sceneDirector.isInScene) sceneDirector.resetToOverview();
    }
    if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault();
      if (timeline.isPlaying) timeline.pause();
      else timeline.play();
    }
  });

  // ---------------------------------------------------------------- 图层开关
  const legendArmies = document.getElementById('legend-armies') as HTMLElement;
  legendArmies.innerHTML = armies
    .map(
      (a) => `
      <div class="lm-legend__item" data-army="${a.id}">
        <span class="lm-legend__swatch" style="background:${a.color}"></span>
        <span class="lm-legend__label" title="${a.short}">${a.short}</span>
        <span class="lm-legend__count">${routeSegments.filter((s) => s.armyId === a.id).length} 段</span>
      </div>`,
    )
    .join('');

  const hiddenArmies = new Set<string>();
  legendArmies.querySelectorAll<HTMLElement>('.lm-legend__item').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.army as string;
      if (hiddenArmies.has(id)) hiddenArmies.delete(id);
      else hiddenArmies.add(id);
      el.classList.toggle('is-off', hiddenArmies.has(id));
      const ids = armies.map((a) => a.id).filter((aid) => !hiddenArmies.has(aid));
      setRouteArmyFilter(map, ids);
      arbiter.setVisibleArmies(new Set(ids));
      routeLabels.setVisible(new Set(ids));
    });
  });

  const toggleEnemyEl = document.getElementById('toggle-enemy-ov');
  toggleEnemyEl?.addEventListener('click', () => {
    const next = !enemyOverview.isEnabled;
    enemyOverview.setEnabled(next);
    sceneDirector.setPostureVisible(next);
    toggleEnemyEl.classList.toggle('is-off', !next);
  });

  const toggleLandmarksEl = document.getElementById('toggle-landmarks');
  toggleLandmarksEl?.addEventListener('click', () => {
    const next = !landmarks.isEnabled;
    landmarks.setEnabled(next);
    toggleLandmarksEl.classList.toggle('is-off', !next);
  });

  const toggleGeoEl = document.getElementById('toggle-geo-labels');
  toggleGeoEl?.addEventListener('click', () => {
    const next = !routeLabels.isGeoEnabled;
    routeLabels.setGeoEnabled(next);
    toggleGeoEl.classList.toggle('is-off', !next);
  });

  const legendKinds = document.getElementById('legend-kinds') as HTMLElement;
  const kinds = Object.keys(KIND_META) as NodeKind[];
  legendKinds.innerHTML = kinds
    .map((k) => {
      const meta = KIND_META[k];
      const count = allNodes.filter((n) => n.kind === k).length;
      return `
        <div class="lm-legend__item" data-kind="${k}">
          <span class="lm-legend__tick" style="color:${meta.color}">
            <svg viewBox="0 0 24 24">${meta.icon}</svg>
          </span>
          <span class="lm-legend__label" title="${meta.label}">${meta.label}</span>
          <span class="lm-legend__count">${count}</span>
        </div>`;
    })
    .join('');

  const visibleKinds = new Set<NodeKind>(kinds);
  legendKinds.querySelectorAll<HTMLElement>('.lm-legend__item').forEach((el) => {
    el.addEventListener('click', () => {
      const k = el.dataset.kind as NodeKind;
      if (visibleKinds.has(k)) visibleKinds.delete(k);
      else visibleKinds.add(k);
      el.classList.toggle('is-off', !visibleKinds.has(k));
      nodeLayer.setVisible(visibleKinds);
    });
  });

  const layersToggle = document.getElementById('layers-toggle') as HTMLButtonElement;
  const layersBody = document.querySelector('.lm-layers__body') as HTMLElement;
  layersToggle.addEventListener('click', () => {
    const expanded = layersToggle.getAttribute('aria-expanded') === 'true';
    layersToggle.setAttribute('aria-expanded', String(!expanded));
    layersBody.style.display = expanded ? 'none' : 'grid';
  });

  document.getElementById('btn-situation')?.addEventListener('click', () => {
    closeDetail();
    sceneDirector.openTheater();
  });

  document.getElementById('btn-overview')?.addEventListener('click', () => {
    closeDetail();
    sceneDirector.resetToOverview();
  });

  const about = document.getElementById('about') as HTMLElement;
  const aboutBody = document.getElementById('about-body') as HTMLElement;
  aboutBody.innerHTML = renderAbout();
  document.getElementById('btn-about')?.addEventListener('click', () => {
    about.classList.add('is-open');
    about.setAttribute('aria-hidden', 'false');
  });
  document.getElementById('about-close')?.addEventListener('click', () => {
    about.classList.remove('is-open');
    about.setAttribute('aria-hidden', 'true');
  });
  about.addEventListener('click', (e) => {
    if (e.target === about) {
      about.classList.remove('is-open');
      about.setAttribute('aria-hidden', 'true');
    }
  });

  loading.classList.add('is-done');
  setTimeout(() => loading.remove(), 700);

  map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, duration: 1800, essential: true });

  (window as unknown as Record<string, unknown>).__lm = {
    map,
    timeline,
    sceneDirector,
    arbiter,
    enemyOverview,
    landmarks,
    routeLabels,
    nodes: allNodes,
    openDetail,
    runGlobalLayout,
    stopFlow,
    selectedId: () => selectedId,
  };
}

boot().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `初始化失败：${err instanceof Error ? err.message : String(err)}`;
});
