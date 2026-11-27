/**
 * 全局屏幕像素空间防压盖仲裁器（LabelArbiter）。
 *
 * 解决痛点：
 * 原先节点层、战略地标层、态势箭头标签层、激战脉冲层各自独立渲染，互不知道对方的像素包围盒，
 * 也不知道红军路线折线的屏幕位置，导致特写场景里出现「字压字、字压路线」的堆叠。
 *
 * 仲裁策略：
 * 1. 每次重排开始时，先把视口内可见的红军路线按 16px 步长采样进 `routeBoxes`（路线避让带），
 *    并把可见图标圆点记入硬碰撞表 `hardBoxes`；
 * 2. 各图层按「激战点 > 聚光战略重镇 > 态势箭头番号 > 核心历史节点 > 普通地标」的优先级依次向仲裁器申请落位；
 * 3. 对每个标签测试多个候选方向（右侧/左侧/上方/下方，或箭头左右两侧法向偏置）：
 *    - 与已落位标签或图标发生矩形相交者直接淘汰（100% 禁止字压字、字压图标）；
 *    - 在无硬碰撞的候选方向中，优先选择「跨压路线采样点最少（理想为 0）」的一侧；
 *    - 若所有方向均产生硬碰撞（或非强制标签严重跨线），则优雅折叠隐藏（悬停仍可查看）。
 */
import type { Map as MlMap } from 'maplibre-gl';
import { routeSegments } from '../data/routes';
import type { LonLat } from '../data/types';

export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PlacementChoice {
  dx: number;
  dy: number;
  /** 标签相对锚点(cx + dx, cy + dy)的对齐锚向 */
  align: 'left' | 'right' | 'center-top' | 'center-bottom';
  box: ScreenBox;
  routeHits: number;
}

function boxesOverlap(a: ScreenBox, b: ScreenBox): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function estimateTextWidth(text: string, fontPx = 11.5, extraPx = 8): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    units += text.charCodeAt(i) > 255 ? 1 : 0.56;
  }
  return Math.ceil(units * fontPx + extraPx);
}

export class LabelArbiter {
  private hardBoxes: ScreenBox[] = [];
  private routeBoxes: ScreenBox[] = [];
  private visibleArmies = new Set<string>(['red1', 'red25', 'red4', 'red2']);
  private vw = 1280;
  private vh = 800;

  constructor(private map: MlMap) {}

  setVisibleArmies(ids: Set<string>) {
    this.visibleArmies = new Set(ids);
  }

  /** 开始新一帧全局排版：清空旧盒并采样视口内的红军路线作为避让障碍 */
  beginPass() {
    this.hardBoxes = [];
    this.routeBoxes = [];
    const container = this.map.getContainer();
    this.vw = container.clientWidth || 1280;
    this.vh = container.clientHeight || 800;

    const pad = 80;
    for (const seg of routeSegments) {
      if (!this.visibleArmies.has(seg.armyId)) continue;
      const pts = seg.path;
      let prev = this.map.project(pts[0].coord);
      for (let i = 1; i < pts.length; i++) {
        const cur = this.map.project(pts[i].coord);
        // 视口外快速剔除
        if (
          (prev.x < -pad && cur.x < -pad) ||
          (prev.x > this.vw + pad && cur.x > this.vw + pad) ||
          (prev.y < -pad && cur.y < -pad) ||
          (prev.y > this.vh + pad && cur.y > this.vh + pad)
        ) {
          prev = cur;
          continue;
        }
        const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
        const steps = Math.max(1, Math.ceil(dist / 16));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = prev.x + (cur.x - prev.x) * t;
          const y = prev.y + (cur.y - prev.y) * t;
          if (x >= -20 && x <= this.vw + 20 && y >= -20 && y <= this.vh + 20) {
            this.routeBoxes.push({ x0: x - 4, y0: y - 4, x1: x + 4, y1: y + 4 });
          }
        }
        prev = cur;
      }
    }
  }

  /** 登记不可被任何文字遮挡的图标圆点区域 */
  reserveIcon(coord: LonLat, radiusPx = 10) {
    const p = this.map.project(coord);
    if (p.x < -40 || p.x > this.vw + 40 || p.y < -40 || p.y > this.vh + 40) return;
    this.hardBoxes.push({
      x0: p.x - radiusPx,
      y0: p.y - radiusPx,
      x1: p.x + radiusPx,
      y1: p.y + radiusPx,
    });
  }

  private boxForCandidate(
    cx: number,
    cy: number,
    w: number,
    h: number,
    dx: number,
    dy: number,
    align: PlacementChoice['align'],
  ): ScreenBox {
    const ax = cx + dx;
    const ay = cy + dy;
    switch (align) {
      case 'left':
        return { x0: ax, y0: ay - h / 2, x1: ax + w, y1: ay + h / 2 };
      case 'right':
        return { x0: ax - w, y0: ay - h / 2, x1: ax, y1: ay + h / 2 };
      case 'center-bottom':
        return { x0: ax - w / 2, y0: ay, x1: ax + w / 2, y1: ay + h };
      case 'center-top':
        return { x0: ax - w / 2, y0: ay - h, x1: ax + w / 2, y1: ay };
    }
  }

  private countRouteHits(box: ScreenBox): number {
    let hits = 0;
    for (const r of this.routeBoxes) {
      if (boxesOverlap(box, r)) hits++;
    }
    return hits;
  }

  private hitsHardBox(box: ScreenBox): boolean {
    // 避开屏幕左右边缘与顶部栏、左侧图层面板边缘
    if (box.x0 < 14 || box.x1 > this.vw - 14 || box.y0 < 58 || box.y1 > this.vh - 115) {
      return true;
    }
    for (const h of this.hardBoxes) {
      if (boxesOverlap(box, h)) return true;
    }
    return false;
  }

  /** 为点状要素（节点、地标、激战点）在四向候选位中择优落位 */
  placeAroundPoint(
    coord: LonLat,
    width: number,
    height: number,
    opts: {
      gap?: number;
      preferred?: PlacementChoice['align'];
      maxRouteHits?: number;
      forceIfSelected?: boolean;
    } = {},
  ): PlacementChoice | null {
    const p = this.map.project(coord);
    if (p.x < -30 || p.x > this.vw + 30 || p.y < -30 || p.y > this.vh + 30) return null;

    const gap = opts.gap ?? 11;
    const preferRight = p.x < this.vw * 0.68;
    const defaultOrder: { dx: number; dy: number; align: PlacementChoice['align'] }[] = preferRight
      ? [
          { dx: gap, dy: 0, align: 'left' },
          { dx: -gap, dy: 0, align: 'right' },
          { dx: 0, dy: -gap, align: 'center-top' },
          { dx: 0, dy: gap, align: 'center-bottom' },
        ]
      : [
          { dx: -gap, dy: 0, align: 'right' },
          { dx: gap, dy: 0, align: 'left' },
          { dx: 0, dy: -gap, align: 'center-top' },
          { dx: 0, dy: gap, align: 'center-bottom' },
        ];

    if (opts.preferred) {
      defaultOrder.sort((a, b) => (a.align === opts.preferred ? -1 : b.align === opts.preferred ? 1 : 0));
    }

    let best: PlacementChoice | null = null;
    for (const cand of defaultOrder) {
      const box = this.boxForCandidate(p.x, p.y, width, height, cand.dx, cand.dy, cand.align);
      if (this.hitsHardBox(box)) continue;
      const routeHits = this.countRouteHits(box);
      if (opts.maxRouteHits !== undefined && routeHits > opts.maxRouteHits) continue;
      if (!best || routeHits < best.routeHits) {
        best = { ...cand, box, routeHits };
        if (routeHits === 0) break;
      }
    }

    if (!best && opts.forceIfSelected) {
      const fallback = defaultOrder[0];
      const box = this.boxForCandidate(p.x, p.y, width, height, fallback.dx, fallback.dy, fallback.align);
      best = { ...fallback, box, routeHits: 0 };
    }

    if (best) {
      this.hardBoxes.push({
        x0: best.box.x0 - 5,
        y0: best.box.y0 - 3,
        x1: best.box.x1 + 5,
        y1: best.box.y1 + 3,
      });
    }
    return best;
  }

  /** 为线性态势要素（箭头、防线、合围圈）沿屏幕法向左右两侧偏置落位，避免文字横压箭身与主路线 */
  placeAlongsideVector(
    coord: LonLat,
    tangentTo: LonLat | undefined,
    width: number,
    height: number,
    normalDist = 16,
  ): PlacementChoice | null {
    const p = this.map.project(coord);
    if (p.x < -30 || p.x > this.vw + 30 || p.y < -30 || p.y > this.vh + 30) return null;

    let nx = 0;
    let ny = -1;
    if (tangentTo) {
      const p2 = this.map.project(tangentTo);
      const tx = p2.x - p.x;
      const ty = p2.y - p.y;
      const tl = Math.hypot(tx, ty);
      if (tl > 1) {
        nx = -ty / tl;
        ny = tx / tl;
      }
    }

    // 根据法向指向决定文字向左或向右展开，使整个标签外推在箭头侧翼空地
    const alignFor = (vx: number, vy: number): PlacementChoice['align'] => {
      if (Math.abs(vx) >= Math.abs(vy) * 0.75) return vx >= 0 ? 'left' : 'right';
      return vy >= 0 ? 'center-bottom' : 'center-top';
    };

    const candidates: { dx: number; dy: number; align: PlacementChoice['align'] }[] = [
      { dx: nx * normalDist, dy: ny * normalDist, align: alignFor(nx, ny) },
      { dx: -nx * normalDist, dy: -ny * normalDist, align: alignFor(-nx, -ny) },
      { dx: nx * (normalDist + 12), dy: ny * (normalDist + 12), align: alignFor(nx, ny) },
      { dx: -nx * (normalDist + 12), dy: -ny * (normalDist + 12), align: alignFor(-nx, -ny) },
    ];

    let best: PlacementChoice | null = null;
    for (const cand of candidates) {
      const box = this.boxForCandidate(p.x, p.y, width, height, cand.dx, cand.dy, cand.align);
      if (this.hitsHardBox(box)) continue;
      const routeHits = this.countRouteHits(box);
      if (!best || routeHits < best.routeHits) {
        best = { ...cand, box, routeHits };
        if (routeHits === 0) break;
      }
    }

    if (best) {
      this.hardBoxes.push({
        x0: best.box.x0 - 6,
        y0: best.box.y0 - 4,
        x1: best.box.x1 + 6,
        y1: best.box.y1 + 4,
      });
    }
    return best;
  }

  get occupiedBoxes(): readonly ScreenBox[] {
    return this.hardBoxes;
  }
}
