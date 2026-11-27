/**
 * 长征项目数据模型。
 *
 * 设计原则：
 * 1. 每条记录都带 `source`（出处）与 `confidence`（置信度），有争议处显式标注，
 *    不把不确定的东西伪装成确定事实；
 * 2. 坐标一律是"示意坐标"——依据现代地名定位到居民点/山口/渡口，非测绘成果，
 *    误差约 ±5~15 km，缩放越大越明显，UI 上需向用户明示；
 * 3. 路线按时间分段（segment），每段带起止日期与说明，时间轴据此推进。
 */

export type LonLat = [number, number];

/** 史料置信度 */
export type Confidence =
  /** 权威党史/军史著作明确记载 */
  | 'high'
  /** 通行说法，个别细节各资料略有出入 */
  | 'medium'
  /** 存在资料冲突或学界争议，须在 UI 中标注 */
  | 'disputed';

export interface SourceRef {
  /** 出处标题 */
  title: string;
  /** 出版/发布机构 */
  publisher?: string;
  /** 可访问链接 */
  url?: string;
}

/** 长征队伍（方面军 / 独立部队） */
export interface Army {
  id: string;
  /** 全称，如"中国工农红军第一方面军" */
  name: string;
  /** 简称，如"红一方面军 · 中央红军" */
  short: string;
  /** 图例主色 */
  color: string;
  /** 出发日期 YYYY-MM-DD */
  startDate: string;
  /** 结束日期 YYYY-MM-DD */
  endDate: string;
  /** 出发地 */
  startPlace: string;
  /** 终点 */
  endPlace: string;
  /** 出发兵力（文字，避免与不同口径数字冲突） */
  strength: string;
  /** 主要领导人 */
  leaders: string;
  /** 行程 */
  distance: string;
  /** 概述 */
  summary: string;
  /** 途经省份 */
  provinces: string[];
  confidence: Confidence;
  source: SourceRef[];
}

/** 路线分段：一段时间内的一条连续行军路径 */
export interface RouteSegment {
  id: string;
  armyId: string;
  /** 起始日期 YYYY-MM-DD */
  from: string;
  /** 结束日期 YYYY-MM-DD */
  to: string;
  /** 分段标题，如"突破第四道封锁线·湘江战役" */
  label: string;
  /** 中途节点顺序：地名 → 坐标 → 可选日期 */
  path: RouteWaypoint[];
  /** 该段行程（里） */
  distanceKm?: number;
  confidence: Confidence;
  note?: string;
}

export interface RouteWaypoint {
  name: string;
  coord: LonLat;
  /** 抵离日期 */
  date?: string;
}

/** 节点类型 */
export type NodeKind =
  /** 重要会议 */
  | 'meeting'
  /** 重要战役战斗 */
  | 'battle'
  /** 自然地理要素：雪山、草地、河流、关隘 */
  | 'geo'
  /** 毛泽东诗词等人文要素 */
  | 'poem'
  /** 重大事件（渡江、会师、出发…） */
  | 'event'
  /** 部队会师 */
  | 'join';

export interface StoryNode {
  id: string;
  kind: NodeKind;
  /** 标题 */
  name: string;
  /** 日期 YYYY-MM-DD；区间用 from/to */
  date: string;
  dateEnd?: string;
  coord: LonLat;
  /** 今属行政区 */
  place: string;
  /** 所属队伍（红军方） */
  armyId?: string;
  /** 一句话摘要（地图挂点标签） */
  brief: string;
  /** 详情正文，支持简单 Markdown 段落 */
  detail: string;
  /** 诗词全文（仅 poem 类型） */
  poem?: {
    title: string;
    lines: string[];
    note?: string;
  };
  /** 兵力/战果等关键数字 */
  facts?: { label: string; value: string }[];
  confidence: Confidence;
  /** 争议说明：当 confidence 为 medium/disputed 时必填 */
  dispute?: string;
  source: SourceRef[];
}

/** 态势图（一场战役/一个阶段的敌我态势） */
export interface Situation {
  id: string;
  title: string;
  subtitle: string;
  /** 时间范围 */
  period: { from: string; to: string };
  /** 镜头：初始视野 */
  camera: { center: LonLat; zoom: number; pitch?: number };
  /** 概述 */
  summary: string;
  /** 参战方 */
  sides: SituationSide[];
  /** 态势阶段（时间轴上的分帧） */
  phases: SituationPhase[];
  /** 常驻地名（不随阶段变化），用于给战场提供地理参照 */
  mapLabels?: { coord: LonLat; text: string }[];
  /**
   * 战场级底图的标识（对应 public/geo/terrain-bounds-<id>.json）。
   * 有则进入该战役时叠加更高精度的地形晕渲；无则沿用总览底图。
   */
  detailTerrain?: string;
  /**
   * 标绘视觉放大系数：数据里的箭头宽度按"真实千米量级"写，
   * 放大到战役级视图时统一乘以此系数，让图形达到可读的屏幕尺寸。
   */
  plotScale?: number;
  confidence: Confidence;
  source: SourceRef[];
}

export interface SituationSide {
  id: 'red' | 'enemy';
  name: string;
  /** 该方总兵力描述 */
  strength: string;
  commander: string;
  /** 下属单位 */
  units: { name: string; strength?: string; note?: string }[];
}

/** 态势阶段：某一时刻在图上呈现的一组标绘图形 */
export interface SituationPhase {
  id: string;
  /** 阶段日期 YYYY-MM-DD */
  date: string;
  /** 阶段标题 */
  title: string;
  /** 阶段叙述 */
  narrative: string;
  /** 该阶段呈现的标绘图形 */
  graphics: PlotGraphic[];
  source?: SourceRef[];
}

/** 标绘图形定义（anim 为阶段内归一化生长时间窗 [start, end] ∈ [0, 1]） */
export type PlotGraphic =
  | {
      id: string;
      kind: 'arrow';
      side: 'red' | 'enemy';
      path: LonLat[];
      style: ArrowPlotStyle;
      label?: string;
      labelAt?: LonLat;
      anim?: [number, number];
    }
  | {
      id: string;
      kind: 'pincer';
      side: 'red' | 'enemy';
      start: LonLat;
      end: LonLat;
      style: ArrowPlotStyle & { spreadRatio?: number };
      label?: string;
      anim?: [number, number];
    }
  | {
      id: string;
      kind: 'assemble';
      side: 'red' | 'enemy';
      center: LonLat;
      radiusX: number;
      radiusY: number;
      rotation?: number;
      label?: string;
      anim?: [number, number];
    }
  | {
      id: string;
      kind: 'defense';
      side: 'red' | 'enemy';
      path: LonLat[];
      toothSize: number;
      toothSide?: 1 | -1;
      label?: string;
      anim?: [number, number];
    }
  | {
      id: string;
      kind: 'block';
      side: 'red' | 'enemy';
      center: LonLat;
      size: number;
      rotation?: number;
      label?: string;
      anim?: [number, number];
    }
  | {
      id: string;
      kind: 'markLine';
      side: 'red' | 'enemy';
      path: LonLat[];
      label?: string;
      dashed?: boolean;
      anim?: [number, number];
    }
  | {
      id: string;
      kind: 'text';
      side: 'red' | 'enemy';
      coord: LonLat;
      text: string;
      size?: number;
      anim?: [number, number];
    }
  | {
      id: string;
      kind: 'clash';
      side: 'red' | 'enemy';
      coord: LonLat;
      label?: string;
      anim?: [number, number];
    };

export interface ArrowPlotStyle {
  /** 箭身宽度（米） */
  width: number;
  headWidth?: number;
  headLength?: number;
  tailTaper?: number;
  /** 两点直连时的微弧弯曲系数（正偏左、负偏右） */
  arcRatio?: number;
}
