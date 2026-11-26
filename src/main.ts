/**
 * 应用主入口：装配地图 / 路线 / 节点 / 时间轴 / 态势面板。
 */
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import './style.css';

import { armies } from './data/armies';
import { centralRedNodes } from './data/nodes-central';
import { otherNodes } from './data/nodes-others';
import { routeSegments } from './data/routes';
import type { NodeKind, StoryNode } from './data/types';
import { buildBaseStyle, loadDetailTerrains, loadTerrainMeta } from './map/basemap';
import { KIND_META, NodeLayer } from './map/nodes';
import { addRouteLayers, splitRoutesAt, startRouteFlow, updateRouteLayers } from './map/routes';
import { addSituationLayers } from './map/situation';
import { renderAbout, renderNodeDetail } from './ui/detail';
import { SituationPanel } from './ui/situationPanel';
import { Timeline } from './ui/timeline';
import { situationBundles } from './data/situations';
import { RouteLabelLayer } from './map/routeLabels';

const allNodes: StoryNode[] = [...centralRedNodes, ...otherNodes].sort((a, b) => a.date.localeCompare(b.date));

/** 长征走廊的整体范围：江西瑞金 → 陕北吴起 → 川西草地 → 滇西北 */
const HOME_BOUNDS: [[number, number], [number, number]] = [
  [98.2, 24.2],
  [117.2, 38.2],
];
const HOME_PADDING = { top: 128, bottom: 176, left: 52, right: 52 };

async function boot() {
  const loading = document.getElementById('loading') as HTMLElement;
  const terrain = await loadTerrainMeta();
  const detailNames = [
    ...new Set(
      situationBundles.map((b) => b.situation.detailTerrain).filter((x): x is string => Boolean(x)),
    ),
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

  // ---------------------------------------------------------------- 图层
  addRouteLayers(map);
  addSituationLayers(map);

  const nodeLayer = new NodeLayer({
    map,
    nodes: allNodes,
    onSelect: (node) => openDetail(node),
  });
  // 路线注记：直接把"这条线是谁的"标在图上，不再只靠图例辨认
  const routeLabels = new RouteLabelLayer(map);

  // ---------------------------------------------------------------- 时间轴
  const timeline = new Timeline({
    start: '1934-10-10',
    end: '1936-10-22',
    markers: allNodes,
    durationSeconds: 56,
    onDate: (iso) => {
      updateRouteLayers(map, splitRoutesAt(iso));
      nodeLayer.setDateCutoff(iso);
    },
  });

  updateRouteLayers(map, splitRoutesAt(timeline.currentDate));
  nodeLayer.setDateCutoff(timeline.currentDate);

  const stopFlow = startRouteFlow(map);

  // ---------------------------------------------------------------- 详情面板
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
    timeline.setDate(node.date);

    // 让点位落在未被抽屉遮挡的区域
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

  document.getElementById('detail-close')?.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetail();
      about.classList.remove('is-open');
      if (situation.isOpen) exitSituation();
    }
    if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault();
      if (timeline.isPlaying) timeline.pause();
      else timeline.play();
    }
  });

  // ---------------------------------------------------------------- 图例 / 图层开关
  const legendArmies = document.getElementById('legend-armies') as HTMLElement;
  legendArmies.innerHTML = armies
    .map(
      (a) => `
      <div class="lm-legend__item" data-army="${a.id}">
        <span class="lm-legend__swatch" style="background:${a.color}"></span>
        <span>${a.short}</span>
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
      applyRouteFilter();
    });
  });

  function applyRouteFilter() {
    const ids = armies.map((a) => a.id).filter((id) => !hiddenArmies.has(id));
    const filter: maplibregl.ExpressionSpecification | null = ids.length
      ? ['in', ['get', 'armyId'], ['literal', ids]]
      : ['==', ['get', 'armyId'], '__none__'];
    for (const lid of [
      'routes-future-line',
      'routes-past-glow',
      'routes-past-line',
      'routes-ghost-line',
      'routes-active-line',
    ]) {
      map.setFilter(lid, filter as unknown as maplibregl.FilterSpecification);
    }
    map.setFilter('route-heads-circle', filter as unknown as maplibregl.FilterSpecification);
    routeLabels.setVisible(new Set(ids));
  }

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
          <span>${meta.label}</span>
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

  // 图层折叠
  const layersToggle = document.getElementById('layers-toggle') as HTMLButtonElement;
  const layersBody = document.querySelector('.lm-layers__body') as HTMLElement;
  layersToggle.addEventListener('click', () => {
    const expanded = layersToggle.getAttribute('aria-expanded') === 'true';
    layersToggle.setAttribute('aria-expanded', String(!expanded));
    layersBody.style.display = expanded ? 'none' : 'grid';
  });

  // ---------------------------------------------------------------- 态势模式
  const situation = new SituationPanel(map, situationBundles, exitSituation);
  const timelineBar = document.getElementById('timeline') as HTMLElement;

  function enterSituation(bundleIndex = situation.currentBundleIndex) {
    timeline.pause();
    closeDetail();
    document.body.classList.add('lm-mode-situation');
    timelineBar.classList.add('is-hidden');
    nodeLayer.setVisible(new Set());
    routeLabels.setMode(true);
    map.setFilter('routes-future-line', ['==', ['get', 'armyId'], '__none__']);
    map.setFilter('routes-past-glow', ['==', ['get', 'armyId'], '__none__']);
    map.setFilter('routes-past-line', ['==', ['get', 'armyId'], '__none__']);
    map.setFilter('routes-active-line', ['==', ['get', 'armyId'], '__none__']);
    map.setFilter('routes-ghost-line', ['==', ['get', 'armyId'], '__none__']);
    map.setFilter('route-heads-circle', ['==', ['get', 'armyId'], '__none__']);
    situation.open(bundleIndex);
  }

  function exitSituation() {
    situation.close();
    document.body.classList.remove('lm-mode-situation');
    timelineBar.classList.remove('is-hidden');
    nodeLayer.setVisible(visibleKinds);
    routeLabels.setMode(false);
    applyRouteFilter();
    map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, duration: 1000 });
  }

  document.getElementById('btn-situation')?.addEventListener('click', () => enterSituation());

  // ---------------------------------------------------------------- 关于
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

  // ---------------------------------------------------------------- 入场动画
  loading.classList.add('is-done');
  setTimeout(() => loading.remove(), 700);

  map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, duration: 2000, essential: true });

  // 供调试与自动化检查使用
  (window as unknown as Record<string, unknown>).__lm = {
    map,
    timeline,
    situation,
    nodes: allNodes,
    openDetail,
    enterSituation,
    exitSituation,
    stopFlow,
    selectedId: () => selectedId,
  };
}

boot().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `初始化失败：${err instanceof Error ? err.message : String(err)}`;
});
