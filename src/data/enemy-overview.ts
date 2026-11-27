import type { Confidence, PlotGraphic, SourceRef } from './types';

/**
 * 总览主图随时间轴联动的国民党军围追堵截态势。
 *
 * 设计口径：
 * - 依据《中国共产党历史》第一卷与军事科学院《长征记》（曲爱国、张从田，华夏出版社 2016），
 *   将 1934.10 — 1936.10 影响红军战略机动方向的关键敌情（四道封锁线、湘西口袋阵、
 *   川黔滇四十万合围、金沙江与大渡河追堵、松潘与腊子口堵截、百丈关与乌蒙山围堵、西北截击）
 *   按历史发生时段配置为示意标绘组。
 * - 所有箭头宽度、防线位置均为宏观叙事尺度的示意标绘，不代表实测战术阵地线。
 */
export interface OverviewEnemyCampaign {
  id: string;
  title: string;
  from: string;
  to: string;
  fadeInDays?: number;
  fadeOutDays?: number;
  graphics: PlotGraphic[];
  confidence: Confidence;
  source: SourceRef[];
}

const SRC_CHANGZHENGJI: SourceRef = {
  title: '《长征记》',
  publisher: '曲爱国、张从田著，华夏出版社 2016',
  url: 'http://dangshi.people.com.cn/GB/146570/406330/index.html',
};

const SRC_HISTORY_V1: SourceRef = {
  title: '《中国共产党历史》第一卷',
  publisher: '中共中央党史研究室著，中共党史出版社',
  url: 'https://www.qstheory.cn/books/2019-07/31/c_1119408590_12.htm',
};

export const overviewEnemyCampaigns: OverviewEnemyCampaign[] = [
  // 1. 第五次“围剿”合围与赣粤湘桂四道封锁线（1934.10 — 1934.12 初）
  {
    id: 'eo-four-blockades',
    title: '第五次“围剿”合围与四道封锁线',
    from: '1934-10-10',
    to: '1934-12-03',
    fadeInDays: 0,
    fadeOutDays: 10,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_HISTORY_V1],
    graphics: [
      {
        id: 'eo1-ring',
        kind: 'markLine',
        side: 'enemy',
        path: [
          [115.20, 26.85],
          [116.45, 26.75],
          [116.95, 25.95],
          [116.40, 25.05],
          [115.35, 24.95],
        ],
        dashed: true,
        label: '国民党军第五次“围剿”合围弧',
      },
      {
        id: 'eo1-north-press',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [116.35, 27.10],
          [116.15, 26.40],
        ],
        style: { width: 15000, headWidth: 38000, headLength: 34000, tailTaper: 0.65 },
        label: '北路顾祝同部压迫苏区',
        labelAt: [116.65, 27.12],
      },
      {
        id: 'eo1-line1',
        kind: 'defense',
        side: 'enemy',
        path: [
          [115.05, 26.08],
          [114.85, 25.12],
        ],
        toothSize: 11000,
        toothSide: -1,
      },
      {
        id: 'eo1-line2',
        kind: 'defense',
        side: 'enemy',
        path: [
          [113.85, 25.88],
          [113.68, 25.05],
        ],
        toothSize: 11000,
        toothSide: -1,
      },
      {
        id: 'eo1-line3',
        kind: 'defense',
        side: 'enemy',
        path: [
          [113.06, 25.95],
          [112.90, 25.08],
        ],
        toothSize: 11000,
        toothSide: -1,
        label: '第一至三道封锁线（粤湘军筑碉堵截）',
      },
      {
        id: 'eo1-line4',
        kind: 'defense',
        side: 'enemy',
        path: [
          [111.12, 26.15],
          [110.75, 25.75],
          [110.55, 25.42],
        ],
        toothSize: 13000,
        toothSide: -1,
        label: '第四道封锁线 · 湘江重兵夹击',
      },
      {
        id: 'eo1-xiang-south',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [111.35, 27.05],
          [111.05, 26.20],
        ],
        style: { width: 15000, headWidth: 38000, headLength: 34000, tailTaper: 0.65 },
        label: '湘军何键部南压',
        labelAt: [111.55, 27.15],
      },
      {
        id: 'eo1-gui-north',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [110.65, 24.50],
          [110.78, 25.32],
        ],
        style: { width: 14000, headWidth: 35000, headLength: 32000, tailTaper: 0.65 },
        label: '桂军白崇禧部北堵',
        labelAt: [110.65, 24.40],
      },
    ],
  },

  // 2. 围追红二十五军 · 独树镇截击（1934.11 中旬 — 1935.02）
  {
    id: 'eo-red25-pursuit',
    title: '鄂豫陕围追与独树镇截击',
    from: '1934-11-16',
    to: '1935-02-15',
    fadeInDays: 5,
    fadeOutDays: 14,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI],
    graphics: [
      {
        id: 'eo2-pursue',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [115.05, 32.35],
          [113.68, 33.05],
        ],
        style: { width: 13000, headWidth: 33000, headLength: 30000, tailTaper: 0.65 },
        label: '国民党军第40军等部围追截击',
        labelAt: [114.95, 32.78],
      },
      {
        id: 'eo2-dushu',
        kind: 'defense',
        side: 'enemy',
        path: [
          [113.45, 33.62],
          [112.92, 33.18],
        ],
        toothSize: 11000,
        toothSide: -1,
        label: '独树镇堵截线',
      },
    ],
  },

  // 3. 湘西重兵口袋阵与乌江防线（1934.12 初 — 1935.01 中旬，解释通道转兵）
  {
    id: 'eo-xiangxi-pocket',
    title: '湘西口袋阵与乌江防线',
    from: '1934-12-02',
    to: '1935-01-19',
    fadeInDays: 5,
    fadeOutDays: 8,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_HISTORY_V1],
    graphics: [
      {
        id: 'eo3-pocket',
        kind: 'defense',
        side: 'enemy',
        path: [
          [109.35, 27.08],
          [110.15, 26.98],
          [110.85, 26.68],
        ],
        toothSize: 13000,
        toothSide: -1,
        label: '湘西五路重兵口袋阵（促成通道转兵）',
      },
      {
        id: 'eo3-pincer',
        kind: 'pincer',
        side: 'enemy',
        start: [110.35, 27.68],
        end: [109.92, 26.55],
        style: { width: 12000, headWidth: 30000, headLength: 28000, spreadRatio: 0.48 },
      },
      {
        id: 'eo3-xueyue',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [110.85, 25.85],
          [109.35, 26.05],
        ],
        style: { width: 14000, headWidth: 35000, headLength: 32000, tailTaper: 0.65 },
        label: '薛岳兵团西追',
        labelAt: [110.35, 25.62],
      },
      {
        id: 'eo3-wujiang',
        kind: 'defense',
        side: 'enemy',
        path: [
          [106.72, 27.28],
          [107.68, 27.48],
        ],
        toothSize: 11000,
        toothSide: -1,
        label: '黔军乌江防线',
      },
    ],
  },

  // 4. 川黔滇四十万大军四面合围（1935.01 下旬 — 1935.04 初，四渡赤水）
  {
    id: 'eo-chishui-ring',
    title: '川黔滇四十万大军合围',
    from: '1935-01-19',
    to: '1935-04-06',
    fadeInDays: 5,
    fadeOutDays: 10,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_HISTORY_V1],
    graphics: [
      {
        id: 'eo4-ring',
        kind: 'markLine',
        side: 'enemy',
        path: [
          [104.75, 28.88],
          [104.25, 27.45],
          [106.55, 26.45],
          [108.05, 27.55],
          [106.85, 29.02],
          [104.75, 28.88],
        ],
        dashed: true,
        label: '国民党军约 40 万川黔滇合围圈',
      },
      {
        id: 'eo4-chuan',
        kind: 'defense',
        side: 'enemy',
        path: [
          [104.65, 28.82],
          [105.75, 28.88],
          [106.68, 29.05],
        ],
        toothSize: 12000,
        toothSide: -1,
        label: '川军刘湘部封锁长江南岸',
      },
      {
        id: 'eo4-central',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [106.95, 26.35],
          [106.82, 27.32],
        ],
        style: { width: 16000, headWidth: 40000, headLength: 35000, tailTaper: 0.68 },
        label: '中央军薛岳兵团北压',
        labelAt: [107.15, 26.30],
      },
      {
        id: 'eo4-dian',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [103.55, 27.25],
          [104.75, 27.58],
        ],
        style: { width: 14000, headWidth: 35000, headLength: 31000, tailTaper: 0.68 },
        label: '滇军孙渡纵队东堵',
        labelAt: [103.65, 27.02],
      },
      {
        id: 'eo4-xiang',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [108.55, 27.95],
          [107.35, 27.58],
        ],
        style: { width: 14000, headWidth: 35000, headLength: 31000, tailTaper: 0.68 },
        label: '湘军封锁乌江东岸',
        labelAt: [108.45, 28.15],
      },
    ],
  },

  // 5. 金沙江尾追、大渡河堵截与川陕防线（1935.04 — 1935.06 中旬）
  {
    id: 'eo-jinsha-dadu',
    title: '金沙江追堵与大渡河防线',
    from: '1935-04-02',
    to: '1935-06-15',
    fadeInDays: 6,
    fadeOutDays: 10,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_HISTORY_V1],
    graphics: [
      {
        id: 'eo5-xueyue',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [105.65, 25.85],
          [103.25, 25.98],
        ],
        style: { width: 15000, headWidth: 38000, headLength: 34000, tailTaper: 0.65 },
        label: '中央军薛岳部尾追至金沙江',
        labelAt: [104.65, 26.22],
      },
      {
        id: 'eo5-dadu',
        kind: 'defense',
        side: 'enemy',
        path: [
          [101.78, 29.38],
          [102.78, 29.38],
        ],
        toothSize: 12000,
        toothSide: -1,
        label: '川军刘湘·刘文辉部大渡河防线',
      },
      {
        id: 'eo5-yaan',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [103.25, 30.15],
          [102.48, 29.72],
        ],
        style: { width: 13000, headWidth: 33000, headLength: 29000, tailTaper: 0.65 },
      },
      {
        id: 'eo5-minjiang',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [104.55, 30.82],
          [104.15, 31.55],
        ],
        style: { width: 13000, headWidth: 33000, headLength: 29000, tailTaper: 0.65 },
        label: '川军邓锡侯等部堵截红四方面军',
        labelAt: [104.95, 30.78],
      },
    ],
  },

  // 6. 松潘重兵堵截、腊子口天险与陕甘尾追（1935.06 中旬 — 1935.11 下旬）
  {
    id: 'eo-songpan-shaanbei',
    title: '松潘堵截与陕甘封锁尾追',
    from: '1935-06-16',
    to: '1935-11-25',
    fadeInDays: 7,
    fadeOutDays: 10,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_HISTORY_V1],
    graphics: [
      {
        id: 'eo6-songpan',
        kind: 'defense',
        side: 'enemy',
        path: [
          [103.42, 32.32],
          [103.78, 33.12],
        ],
        toothSize: 12000,
        toothSide: 1,
        label: '胡宗南部扼守松潘（迫红军穿越草地）',
      },
      {
        id: 'eo6-lazikou',
        kind: 'block',
        side: 'enemy',
        center: [103.62, 34.15],
        size: 24000,
        rotation: 25,
        label: '鲁大昌部扼守腊子口',
      },
      {
        id: 'eo6-cavalry',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [106.55, 35.42],
          [107.88, 36.62],
        ],
        style: { width: 13000, headWidth: 33000, headLength: 30000, tailTaper: 0.65 },
        label: '国民党骑兵尾追（吴起镇“切尾巴”）',
        labelAt: [106.45, 35.15],
      },
      {
        id: 'eo6-zhiluo',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [108.05, 35.75],
          [108.92, 36.05],
        ],
        style: { width: 12000, headWidth: 30000, headLength: 27000, tailTaper: 0.65 },
        label: '国民党军进犯直罗镇',
        labelAt: [108.35, 35.52],
      },
    ],
  },

  // 7. 湘鄂川黔合围、川军百丈关反扑与乌蒙山五纵队围堵（1935.11 — 1936.04）
  {
    id: 'eo-wumeng-baizhang',
    title: '湘鄂川黔合围、百丈关反扑与乌蒙山围堵',
    from: '1935-11-08',
    to: '1936-04-25',
    fadeInDays: 7,
    fadeOutDays: 12,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_HISTORY_V1],
    graphics: [
      {
        id: 'eo7-sangzhi',
        kind: 'pincer',
        side: 'enemy',
        start: [111.35, 29.35],
        end: [110.35, 29.38],
        style: { width: 12000, headWidth: 30000, headLength: 28000, spreadRatio: 0.5 },
        label: '国民党军百余团合围湘鄂川黔苏区',
      },
      {
        id: 'eo7-baizhang',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [104.18, 30.22],
          [103.32, 30.16],
        ],
        style: { width: 14000, headWidth: 35000, headLength: 31000, tailTaper: 0.68 },
        label: '川军主力80余团百丈关反扑',
        labelAt: [104.25, 29.95],
      },
      {
        id: 'eo7-wumeng-ring',
        kind: 'markLine',
        side: 'enemy',
        path: [
          [103.95, 27.62],
          [103.82, 26.55],
          [105.05, 26.48],
          [105.45, 27.45],
          [103.95, 27.62],
        ],
        dashed: true,
      },
      {
        id: 'eo7-wumeng-pincer',
        kind: 'pincer',
        side: 'enemy',
        start: [105.75, 26.82],
        end: [104.65, 27.08],
        style: { width: 12000, headWidth: 31000, headLength: 28000, spreadRatio: 0.48 },
        label: '国民党军5个纵队十余万围堵乌蒙山',
      },
    ],
  },

  // 8. 甘南与静会公路截击（1936.05 — 1936.10，阻挠三大主力会师）
  {
    id: 'eo-northwest-block',
    title: '甘南与静会线截击',
    from: '1936-05-01',
    to: '1936-10-22',
    fadeInDays: 10,
    fadeOutDays: 5,
    confidence: 'high',
    source: [SRC_CHANGZHENGJI],
    graphics: [
      {
        id: 'eo8-jinghui',
        kind: 'defense',
        side: 'enemy',
        path: [
          [104.45, 35.12],
          [105.95, 35.38],
        ],
        toothSize: 12000,
        toothSide: 1,
        label: '胡宗南·毛炳文部静会线截击',
      },
      {
        id: 'eo8-east-press',
        kind: 'arrow',
        side: 'enemy',
        path: [
          [106.65, 35.15],
          [105.62, 35.58],
        ],
        style: { width: 14000, headWidth: 35000, headLength: 31000, tailTaper: 0.68 },
        label: '国民党军企图阻断三大主力会师',
        labelAt: [106.75, 34.95],
      },
    ],
  },
];
