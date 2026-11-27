import type { LonLat, PlotGraphic } from './types';
import { chishuiHydrography } from './situations/sidu-chishui';
import { xiangjiangHydrography } from './situations/xiangjiang';
import { jinshaDaduHydrography } from './situations/jinsha-dadu';

/**
 * 六大核心战役场景剧本（主线贯通 + 镜头自动编排 + 箭头/防线/激战点渐进动画）。
 *
 * 设计原则：
 * 1. 红军长征路线始终留在沙盘上作为连续空间主轴，场景只负责把镜头推近到战场比例尺，
 *    叠加高精度地形、水系、动态生长的敌我箭头/封锁线、激战波纹与战略重镇高亮（如贵阳、昆明、松潘）；
 * 2. 每个场景拆成 2~5 个紧凑的叙事节拍（SceneBeat），每个节拍带独立起止日期与镜头微调，
 *    随时间轴推进自动推演，也可由用户点选节拍直接检视。
 */
export interface SceneCamera {
  center: LonLat;
  zoom: number;
}

export interface SceneBeat {
  id: string;
  from: string;
  to: string;
  dateLabel: string;
  title: string;
  caption: string;
  camera: SceneCamera;
  /** 本节拍特写高亮的战略/战术地标 ID（对应 landmarks.ts） */
  focusLandmarks?: string[];
  graphics: PlotGraphic[];
}

export interface CampaignScene {
  id: string;
  index: number;
  shortTitle: string;
  title: string;
  subtitle: string;
  from: string;
  to: string;
  redSide: { name: string; strength: string };
  enemySide: { name: string; strength: string };
  detailTerrain?: string;
  plotScale?: number;
  hydro: Record<string, LonLat[]>;
  beats: SceneBeat[];
}

export const CAMPAIGN_SCENES: CampaignScene[] = [
  // ══════════════════════════════════════════════ 场景 1：血战湘江
  {
    id: 'sc-xiangjiang',
    index: 1,
    shortTitle: '血战湘江',
    title: '血战湘江 · 突破第四道封锁线',
    subtitle: '1934.11.25 — 12.01 · 三十公里渡口生死阻击，8.6 万锐减至 3 万余人',
    from: '1934-11-24',
    to: '1934-12-02',
    redSide: { name: '中央红军主力', strength: '8.6万 → 3万余' },
    enemySide: { name: '湘军·桂军·中央军', strength: '约 30 个团' },
    detailTerrain: 'xiangjiang',
    plotScale: 1,
    hydro: xiangjiangHydrography,
    beats: [
      {
        id: 'xj-b1',
        from: '1934-11-24',
        to: '1934-11-27',
        dateLabel: '11.25 — 11.27',
        title: '四面合逼 · 抢占界首渡口',
        caption:
          '蒋介石沿湘江布设第四道封锁线，湘军自全州南压、桂军自灌阳北堵、中央军尾追；红军先遣抢占界首渡口打开通道。',
        camera: { center: [110.95, 25.72], zoom: 8.15 },
        focusLandmarks: ['lm-quanzhou', 'lm-jieshou', 'lm-guanyang', 'lm-guilin'],
        graphics: [
          {
            id: 'xj1-fort',
            kind: 'defense',
            side: 'enemy',
            path: [
              [111.02, 25.95],
              [110.80, 25.88],
              [110.60, 25.76],
            ],
            toothSize: 2500,
            toothSide: -1,
            label: '第四道封锁线（湘江防线）',
            anim: [0.0, 0.38],
          },
          {
            id: 'xj1-xiang',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [111.07, 25.96],
              [110.95, 25.80],
            ],
            style: { width: 4600, headWidth: 10800, headLength: 9200, tailTaper: 0.7 },
            label: '湘军刘建绪四个师南压',
            anim: [0.08, 0.55],
          },
          {
            id: 'xj1-gui',
            kind: 'pincer',
            side: 'enemy',
            start: [110.95, 25.38],
            end: [110.78, 25.70],
            style: { width: 2600, headWidth: 6800, headLength: 5800, spreadRatio: 0.48 },
            label: '桂军夏威·廖磊部北上夹击',
            anim: [0.12, 0.62],
          },
          {
            id: 'xj1-chase',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [111.68, 25.56],
              [111.30, 25.63],
            ],
            style: { width: 4200, headWidth: 9800, headLength: 8500, tailTaper: 0.7 },
            label: '中央军薛岳部尾追',
            anim: [0.15, 0.65],
          },
          {
            id: 'xj1-red',
            kind: 'arrow',
            side: 'red',
            path: [
              [111.25, 25.62],
              [110.92, 25.74],
              [110.63, 25.83],
            ],
            style: { width: 3200, headWidth: 7800, headLength: 6800, tailTaper: 0.55 },
            label: '先遣抢占界首渡口',
            anim: [0.28, 0.82],
          },
        ],
      },
      {
        id: 'xj-b2',
        from: '1934-11-28',
        to: '1934-12-02',
        dateLabel: '11.28 — 12.01',
        title: '三大阻击血战 · 掩护主力西渡',
        caption:
          '脚山铺、光华铺、新圩三处阵地浴血死守，拼死顶住湘桂军合击钳口；中央纵队渡过湘江，殿后红三十四师陷入重围壮烈牺牲。',
        camera: { center: [110.82, 25.70], zoom: 8.35 },
        focusLandmarks: ['lm-jieshou', 'lm-quanzhou', 'lm-xingan'],
        graphics: [
          {
            id: 'xj2-def1',
            kind: 'defense',
            side: 'red',
            path: [
              [111.00, 25.82],
              [110.89, 25.74],
            ],
            toothSize: 2500,
            toothSide: -1,
            label: '脚山铺阻击（红一军团）',
            anim: [0.0, 0.35],
          },
          {
            id: 'xj2-def2',
            kind: 'defense',
            side: 'red',
            path: [
              [110.72, 25.76],
              [110.64, 25.67],
            ],
            toothSize: 2400,
            toothSide: 1,
            label: '光华铺阻击（红三军团）',
            anim: [0.04, 0.38],
          },
          {
            id: 'xj2-def3',
            kind: 'defense',
            side: 'red',
            path: [
              [111.04, 25.49],
              [110.95, 25.41],
            ],
            toothSize: 2400,
            toothSide: 1,
            label: '新圩阻击（红五师）',
            anim: [0.08, 0.42],
          },
          {
            id: 'xj2-e1',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [111.10, 25.91],
              [110.96, 25.79],
            ],
            style: { width: 5200, headWidth: 12000, headLength: 10000, tailTaper: 0.72 },
            label: '湘军四师猛扑脚山铺',
            anim: [0.12, 0.58],
          },
          {
            id: 'xj2-e2',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [111.09, 25.37],
              [110.98, 25.48],
            ],
            style: { width: 4400, headWidth: 10000, headLength: 8500, tailTaper: 0.72 },
            label: '桂军猛攻新圩·截断江东',
            anim: [0.16, 0.62],
          },
          {
            id: 'xj2-cross',
            kind: 'arrow',
            side: 'red',
            path: [
              [110.90, 25.80],
              [110.63, 25.83],
              [110.42, 25.68],
            ],
            style: { width: 3800, headWidth: 9000, headLength: 7800, tailTaper: 0.5 },
            label: '主力突破封锁西进老山界',
            anim: [0.25, 0.80],
          },
          {
            id: 'xj2-c1',
            kind: 'clash',
            side: 'red',
            coord: [110.94, 25.78],
            label: '脚山铺血战',
            anim: [0.28, 0.65],
          },
          {
            id: 'xj2-c2',
            kind: 'clash',
            side: 'red',
            coord: [111.04, 25.60],
            label: '红34师江东断后绝战',
            anim: [0.35, 0.75],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════ 场景 2：通道转兵与强渡乌江
  {
    id: 'sc-tongdao',
    index: 2,
    shortTitle: '通道转兵',
    title: '通道转兵 · 避开湘西口袋阵智取遵义',
    subtitle: '1934.12.11 — 1935.01.17 · 放弃北上钻袋之危，西折入黔迎来历史转折',
    from: '1934-12-10',
    to: '1935-01-17',
    redSide: { name: '中央红军', strength: '3 万余人' },
    enemySide: { name: '何键湘西五路军 + 黔军', strength: '约 20 万人' },
    plotScale: 2.5,
    hydro: { wujiang: chishuiHydrography.wujiang },
    beats: [
      {
        id: 'td-b1',
        from: '1934-12-10',
        to: '1934-12-26',
        dateLabel: '12.12 — 12.18',
        title: '湘西重兵布袋 · 通道果断西转',
        caption:
          '蒋介石在北上湘西通道布下五路近二十万重兵口袋阵；通道会议采纳毛泽东建议突然西折入黔，令敌重兵扑空。',
        camera: { center: [109.25, 26.62], zoom: 6.55 },
        focusLandmarks: ['lm-zhijiang'],
        graphics: [
          {
            id: 'td1-pocket',
            kind: 'defense',
            side: 'enemy',
            path: [
              [109.15, 27.12],
              [110.05, 27.02],
              [110.75, 26.68],
            ],
            toothSize: 5200,
            toothSide: -1,
            label: '湘军何键五路大军口袋阵',
            anim: [0.0, 0.42],
          },
          {
            id: 'td1-pincer',
            kind: 'pincer',
            side: 'enemy',
            start: [110.20, 27.65],
            end: [109.85, 26.55],
            style: { width: 4800, headWidth: 12500, headLength: 11500, spreadRatio: 0.48 },
            label: '企图诱歼北上红军',
            anim: [0.08, 0.56],
          },
          {
            id: 'td1-turn',
            kind: 'arrow',
            side: 'red',
            path: [
              [110.01, 25.79],
              [109.78, 26.16],
              [109.14, 26.23],
              [108.07, 26.73],
            ],
            style: { width: 4600, headWidth: 12500, headLength: 11500, tailTaper: 0.5 },
            label: '通道转兵 · 黎平定策西进贵州',
            anim: [0.24, 0.82],
          },
        ],
      },
      {
        id: 'td-b2',
        from: '1934-12-27',
        to: '1935-01-17',
        dateLabel: '01.01 — 01.17',
        title: '强渡乌江天险 · 攻占遵义召开遵义会议',
        caption:
          '红军突破黔军乌江江界河防线，1 月 7 日智取遵义；15—17 日召开遵义会议，确立毛泽东的领导地位。',
        camera: { center: [107.45, 27.25], zoom: 6.95 },
        focusLandmarks: ['lm-guiyang'],
        graphics: [
          {
            id: 'td2-wujiang',
            kind: 'defense',
            side: 'enemy',
            path: [
              [106.72, 27.18],
              [107.25, 27.28],
              [107.75, 27.58],
            ],
            toothSize: 4500,
            toothSide: -1,
            label: '黔军王家烈部乌江防线',
            anim: [0.0, 0.38],
          },
          {
            id: 'td2-chase',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [108.65, 26.55],
              [107.75, 26.88],
            ],
            style: { width: 5200, headWidth: 13500, headLength: 12000, tailTaper: 0.7 },
            label: '中央军薛岳部尾追至乌江南岸',
            anim: [0.12, 0.58],
          },
          {
            id: 'td2-cross',
            kind: 'arrow',
            side: 'red',
            path: [
              [107.47, 27.07],
              [107.25, 27.20],
              [106.93, 27.70],
            ],
            style: { width: 4800, headWidth: 13000, headLength: 12000, tailTaper: 0.5 },
            label: '强渡江界河 · 直取遵义',
            anim: [0.22, 0.78],
          },
          {
            id: 'td2-clash',
            kind: 'clash',
            side: 'red',
            coord: [107.25, 27.20],
            label: '强渡乌江突破口',
            anim: [0.32, 0.72],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════ 场景 3：四渡赤水 · 奇袭贵阳
  {
    id: 'sc-chishui',
    index: 3,
    shortTitle: '四渡赤水·奇袭贵阳',
    title: '四渡赤水 · 奇袭贵阳调虎离山',
    subtitle: '1935.01.19 — 04.16 · 3.7 万对 40 万四面合围，声东击西跳出铁桶阵',
    from: '1935-01-19',
    to: '1935-04-16',
    redSide: { name: '中央红军', strength: '3.7 万余人' },
    enemySide: { name: '川·黔·滇·湘·中央军', strength: '约 40 万人' },
    detailTerrain: 'sidu',
    plotScale: 2.5,
    hydro: chishuiHydrography,
    beats: [
      {
        id: 'cs-b1',
        from: '1935-01-19',
        to: '1935-02-10',
        dateLabel: '01.19 — 02.09',
        title: '四十万合围 · 土城受阻一渡赤水',
        caption:
          '川军封死泸州、宜宾长江渡口，四十万敌军四面压境；红军土城受阻后当机立断一渡赤水西入川南，集结扎西整编。',
        camera: { center: [105.95, 28.05], zoom: 7.05 },
        focusLandmarks: ['lm-luzhou', 'lm-yibin', 'lm-gulin'],
        graphics: [
          {
            id: 'cs1-ring',
            kind: 'markLine',
            side: 'enemy',
            path: [
              [104.70, 28.82],
              [104.55, 27.40],
              [106.70, 26.68],
              [107.55, 27.55],
              [106.65, 29.02],
              [104.70, 28.82],
            ],
            dashed: true,
            label: '国民党军 40 万四面合围圈',
            anim: [0.0, 0.40],
          },
          {
            id: 'cs1-chuan',
            kind: 'defense',
            side: 'enemy',
            path: [
              [104.63, 28.77],
              [105.44, 28.87],
              [106.45, 28.98],
            ],
            toothSize: 4800,
            toothSide: -1,
            label: '川军潘文华·郭勋祺锁死长江',
            anim: [0.04, 0.42],
          },
          {
            id: 'cs1-xue',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [106.88, 27.02],
              [106.75, 27.58],
            ],
            style: { width: 7800, headWidth: 20000, headLength: 18000, tailTaper: 0.7 },
            label: '薛岳兵团自南北压',
            anim: [0.08, 0.55],
          },
          {
            id: 'cs1-dian',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [104.10, 27.40],
              [104.82, 27.68],
            ],
            style: { width: 6200, headWidth: 16500, headLength: 15000, tailTaper: 0.7 },
            label: '滇军孙渡部东逼扎西',
            anim: [0.12, 0.58],
          },
          {
            id: 'cs1-red',
            kind: 'arrow',
            side: 'red',
            path: [
              [106.93, 27.70],
              [106.02, 28.22],
              [105.81, 28.18],
              [105.05, 27.84],
            ],
            style: { width: 5200, headWidth: 14000, headLength: 13000, tailTaper: 0.5 },
            label: '① 一渡赤水 · 集结扎西',
            anim: [0.22, 0.80],
          },
          {
            id: 'cs1-clash',
            kind: 'clash',
            side: 'red',
            coord: [106.02, 28.22],
            label: '土城青杠坡激战',
            anim: [0.30, 0.70],
          },
        ],
      },
      {
        id: 'cs-b2',
        from: '1935-02-11',
        to: '1935-03-05',
        dateLabel: '02.18 — 02.28',
        title: '二渡赤水 · 娄山关遵义大捷',
        caption:
          '乘敌主力西调川滇边、黔北空虚，红军自太平渡、二郎滩二渡赤水杀回马枪，夺娄山关、再占遵义，歼敌二师八团。',
        camera: { center: [106.25, 27.95], zoom: 7.25 },
        focusLandmarks: ['lm-taipingdu', 'lm-tongzi'],
        graphics: [
          {
            id: 'cs2-cross',
            kind: 'arrow',
            side: 'red',
            path: [
              [105.05, 27.84],
              [105.95, 28.32],
              [106.83, 28.13],
              [106.93, 27.70],
            ],
            style: { width: 5400, headWidth: 14500, headLength: 13500, tailTaper: 0.48 },
            label: '② 二渡赤水 · 回师再占遵义',
            anim: [0.06, 0.65],
          },
          {
            id: 'cs2-pincer',
            kind: 'pincer',
            side: 'red',
            start: [106.83, 28.05],
            end: [106.93, 27.68],
            style: { width: 3600, headWidth: 10500, headLength: 9800, spreadRatio: 0.5 },
            label: '钳击歼敌二师又八团',
            anim: [0.30, 0.82],
          },
          {
            id: 'cs2-wu',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [107.02, 27.02],
              [106.96, 27.52],
            ],
            style: { width: 6500, headWidth: 17500, headLength: 15500, tailTaper: 0.7 },
            label: '吴奇伟纵队北援被击溃',
            anim: [0.15, 0.62],
          },
          {
            id: 'cs2-clash',
            kind: 'clash',
            side: 'red',
            coord: [106.83, 28.00],
            label: '娄山关大捷',
            anim: [0.35, 0.75],
          },
        ],
      },
      {
        id: 'cs-b3',
        from: '1935-03-06',
        to: '1935-03-20',
        dateLabel: '03.10 — 03.18',
        title: '苟坝拒险 · 三渡茅台诱敌西进',
        caption:
          '苟坝会议否决强攻打鼓新场坚城；红军于茅台白天大张旗鼓三渡赤水西向古蔺，将国民党各路大军全部吸往川南。',
        camera: { center: [106.10, 27.95], zoom: 7.2 },
        focusLandmarks: ['lm-daguxinchang', 'lm-maotai', 'lm-gulin'],
        graphics: [
          {
            id: 'cs3-red',
            kind: 'arrow',
            side: 'red',
            path: [
              [106.93, 27.70],
              [106.30, 27.66],
              [106.38, 27.85],
              [105.81, 28.18],
            ],
            style: { width: 5400, headWidth: 15000, headLength: 14000, tailTaper: 0.48 },
            label: '③ 三渡赤水（茅台白天渡河诱敌）',
            anim: [0.05, 0.58],
          },
          {
            id: 'cs3-e-east',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [107.25, 27.32],
              [106.05, 27.85],
            ],
            style: { width: 8200, headWidth: 21000, headLength: 19000, tailTaper: 0.72 },
            label: '中央军主力蜂拥西追川南',
            anim: [0.22, 0.78],
          },
          {
            id: 'cs3-e-north',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [105.82, 28.82],
              [105.81, 28.28],
            ],
            style: { width: 7000, headWidth: 18500, headLength: 16500, tailTaper: 0.72 },
            label: '川军南压古蔺',
            anim: [0.26, 0.80],
          },
          {
            id: 'cs3-ring',
            kind: 'markLine',
            side: 'enemy',
            path: [
              [105.10, 28.60],
              [104.85, 27.75],
              [105.95, 27.62],
              [106.25, 28.45],
              [105.10, 28.60],
            ],
            dashed: true,
            label: '敌军合围圈尽吸向川南',
            anim: [0.32, 0.85],
          },
        ],
      },
      {
        id: 'cs-b4',
        from: '1935-03-21',
        to: '1935-04-16',
        dateLabel: '03.21 — 04.15',
        title: '四渡赤水 · 奇袭贵阳调出滇军',
        caption:
          '红军夜间秘密四渡赤水南跃乌江，直逼蒋介石坐镇的贵阳城下！蒋急令滇军孙渡部东援贵阳，红军乘云南空虚擦城疾进滇境。',
        camera: { center: [106.15, 27.18], zoom: 6.75 },
        focusLandmarks: ['lm-guiyang', 'lm-taipingdu', 'lm-xifeng'],
        graphics: [
          {
            id: 'cs4-e-empty',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [106.55, 27.85],
              [105.75, 28.18],
            ],
            style: { width: 8200, headWidth: 21000, headLength: 19000, tailTaper: 0.75 },
            label: '敌主力扑向川南（扑空）',
            anim: [0.0, 0.42],
          },
          {
            id: 'cs4-r-south',
            kind: 'arrow',
            side: 'red',
            path: [
              [105.81, 28.18],
              [105.98, 28.35],
              [106.79, 27.16],
              [106.72, 26.75],
            ],
            style: { width: 5400, headWidth: 15000, headLength: 13800, tailTaper: 0.48 },
            label: '④ 四渡南跃乌江 · 兵临贵阳城下',
            anim: [0.08, 0.62],
          },
          {
            id: 'cs4-dian-lured',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [104.25, 25.95],
              [105.65, 26.38],
              [106.52, 26.56],
            ],
            style: { width: 6500, headWidth: 17500, headLength: 15500, tailTaper: 0.7 },
            label: '滇军孙渡部急调东援贵阳（中计）',
            anim: [0.26, 0.78],
          },
          {
            id: 'cs4-r-west',
            kind: 'arrow',
            side: 'red',
            path: [
              [106.66, 26.42],
              [105.19, 25.43],
              [104.20, 25.35],
            ],
            style: { width: 5600, headWidth: 15000, headLength: 14000, tailTaper: 0.5 },
            label: '虚晃一枪 · 乘虚疾进云南',
            anim: [0.36, 0.88],
          },
          {
            id: 'cs4-clash-gy',
            kind: 'clash',
            side: 'red',
            coord: [106.72, 26.68],
            label: '奇袭逼近贵阳',
            anim: [0.32, 0.75],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════ 场景 4：巧渡金沙江 · 飞夺泸定桥
  {
    id: 'sc-jinsha-dadu',
    index: 4,
    shortTitle: '金沙江·泸定桥',
    title: '巧渡金沙江 · 强渡大渡河飞夺泸定桥',
    subtitle: '1935.04.24 — 06.02 · 七船巧渡甩数十万追兵，昼夜 240 里夺铁索天险',
    from: '1935-04-24',
    to: '1935-06-02',
    redSide: { name: '中央红军', strength: '约 3 万余人' },
    enemySide: { name: '薛岳追军 + 川军刘湘·刘文辉部', strength: '十余万人' },
    plotScale: 3.1,
    hydro: jinshaDaduHydrography,
    beats: [
      {
        id: 'jd-b1',
        from: '1935-04-24',
        to: '1935-05-12',
        dateLabel: '04.27 — 05.09',
        title: '佯逼昆明 · 皎平渡七船巧渡金沙江',
        caption:
          '红军一部虚逼昆明调走江防民团，主力直插禄劝皎平渡，凭 7 只木船 7 天 7 夜渡过金沙江，薛岳追军赶到南岸扑空。',
        camera: { center: [102.85, 25.95], zoom: 6.75 },
        focusLandmarks: ['lm-kunming', 'lm-qujing'],
        graphics: [
          {
            id: 'jd1-feint',
            kind: 'arrow',
            side: 'red',
            path: [
              [103.26, 25.56],
              [102.82, 25.18],
            ],
            style: { width: 3800, headWidth: 10000, headLength: 9200, tailTaper: 0.5 },
            label: '佯逼昆明调空江防',
            anim: [0.05, 0.50],
          },
          {
            id: 'jd1-cross',
            kind: 'arrow',
            side: 'red',
            path: [
              [103.26, 25.56],
              [102.47, 25.55],
              [102.31, 26.47],
              [102.25, 26.66],
            ],
            style: { width: 5400, headWidth: 14500, headLength: 13500, tailTaper: 0.48 },
            label: '皎平渡 7 船北渡金沙江',
            anim: [0.15, 0.75],
          },
          {
            id: 'jd1-chase',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [104.45, 25.78],
              [102.62, 26.18],
            ],
            style: { width: 7200, headWidth: 18500, headLength: 16500, tailTaper: 0.72 },
            label: '中央军追抵江边扑空',
            anim: [0.28, 0.82],
          },
        ],
      },
      {
        id: 'jd-b2',
        from: '1935-05-13',
        to: '1935-06-02',
        dateLabel: '05.22 — 05.29',
        title: '彝海结盟 · 强渡安顺场与飞夺泸定桥',
        caption:
          '刘伯承彝海结盟借道大凉山，安顺场十七勇士强渡大渡河；红四团西岸暴雨昼夜急行军 240 里，22 勇士攀 13 根铁索夺下泸定桥。',
        camera: { center: [102.38, 29.25], zoom: 7.15 },
        focusLandmarks: ['lm-xichang', 'lm-yaan'],
        graphics: [
          {
            id: 'jd2-dadu',
            kind: 'defense',
            side: 'enemy',
            path: [
              [101.85, 29.30],
              [102.75, 29.32],
            ],
            toothSize: 4800,
            toothSide: -1,
            label: '川康军刘文辉部大渡河防线',
            anim: [0.0, 0.38],
          },
          {
            id: 'jd2-yaan',
            kind: 'arrow',
            side: 'enemy',
            path: [
              [103.00, 29.98],
              [102.45, 29.92],
            ],
            style: { width: 5400, headWidth: 14000, headLength: 12500, tailTaper: 0.7 },
            label: '川军自雅安西援泸定（迟一步）',
            anim: [0.15, 0.65],
          },
          {
            id: 'jd2-west',
            kind: 'arrow',
            side: 'red',
            path: [
              [102.15, 28.32],
              [102.28, 29.20],
              [102.16, 29.58],
              [102.23, 29.91],
            ],
            style: { width: 5000, headWidth: 13500, headLength: 12500, tailTaper: 0.5 },
            label: '240 里奔袭飞夺泸定桥',
            anim: [0.18, 0.80],
          },
          {
            id: 'jd2-c1',
            kind: 'clash',
            side: 'red',
            coord: [102.30, 29.20],
            label: '安顺场17勇士强渡',
            anim: [0.25, 0.65],
          },
          {
            id: 'jd2-c2',
            kind: 'clash',
            side: 'red',
            coord: [102.23, 29.91],
            label: '22勇士夺占铁索桥',
            anim: [0.42, 0.85],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════ 场景 5：雪山草地 · 突破腊子口
  {
    id: 'sc-grassland-lazikou',
    index: 5,
    shortTitle: '雪山草地·腊子口',
    title: '懋功会师 · 穿越草地与奇袭腊子口',
    subtitle: '1935.06.12 — 09.20 · 胡宗南锁死松潘，踏过 600 里沼泽夺取甘南咽喉',
    from: '1935-06-12',
    to: '1935-09-20',
    redSide: { name: '红一、四方面军 / 陕甘支队', strength: '两大主力会师北上' },
    enemySide: { name: '胡宗南部主力 + 鲁大昌部', strength: '松潘重兵筑碉封锁' },
    plotScale: 2.8,
    hydro: {},
    beats: [
      {
        id: 'gl-b1',
        from: '1935-06-12',
        to: '1935-08-19',
        dateLabel: '06.12 — 08.19',
        title: '翻越夹金山 · 懋功会师与松潘受阻',
        caption:
          '中央红军翻越海拔 4000 米夹金山与红四方面军懋功会师；因胡宗南主力重兵锁死松潘大道，两河口、毛儿盖定策改道草地北上。',
        camera: { center: [102.85, 31.85], zoom: 6.65 },
        focusLandmarks: ['lm-songpan'],
        graphics: [
          {
            id: 'gl1-red1',
            kind: 'arrow',
            side: 'red',
            path: [
              [102.81, 30.37],
              [102.72, 30.85],
              [102.36, 31.00],
            ],
            style: { width: 4600, headWidth: 12000, headLength: 11000, tailTaper: 0.5 },
            label: '翻越夹金山会师懋功',
            anim: [0.05, 0.55],
          },
          {
            id: 'gl1-red4',
            kind: 'arrow',
            side: 'red',
            path: [
              [103.85, 31.68],
              [103.17, 31.44],
              [102.36, 31.00],
            ],
            style: { width: 4600, headWidth: 12000, headLength: 11000, tailTaper: 0.5 },
            label: '红四方面军西进接应',
            anim: [0.08, 0.58],
          },
          {
            id: 'gl1-songpan',
            kind: 'defense',
            side: 'enemy',
            path: [
              [103.35, 32.25],
              [103.75, 33.05],
            ],
            toothSize: 5200,
            toothSide: 1,
            label: '胡宗南部重兵锁死松潘大道',
            anim: [0.22, 0.72],
          },
        ],
      },
      {
        id: 'gl-b2',
        from: '1935-08-20',
        to: '1935-09-20',
        dateLabel: '08.21 — 09.17',
        title: '穿越松潘草地 · 包座大捷与奇袭腊子口',
        caption:
          '右路军穿越 600 里高原沼泽，包座战斗全歼胡宗南部第 49 师；9 月 17 日正面强攻加绝壁迂回，一举攻破天险腊子口。',
        camera: { center: [103.35, 33.48], zoom: 6.95 },
        focusLandmarks: ['lm-songpan'],
        graphics: [
          {
            id: 'gl2-songpan',
            kind: 'defense',
            side: 'enemy',
            path: [
              [103.42, 32.35],
              [103.75, 33.00],
            ],
            toothSize: 4800,
            toothSide: 1,
            label: '胡宗南部松潘封锁线',
            anim: [0.0, 0.35],
          },
          {
            id: 'gl2-grass',
            kind: 'arrow',
            side: 'red',
            path: [
              [102.98, 32.55],
              [102.92, 33.15],
              [103.28, 34.05],
              [103.58, 34.13],
            ],
            style: { width: 5200, headWidth: 14000, headLength: 13000, tailTaper: 0.48 },
            label: '穿越草地 · 奇袭突破腊子口',
            anim: [0.12, 0.78],
          },
          {
            id: 'gl2-lazi',
            kind: 'block',
            side: 'enemy',
            center: [103.62, 34.13],
            size: 8500,
            rotation: 20,
            label: '鲁大昌部扼守腊子口',
            anim: [0.08, 0.45],
          },
          {
            id: 'gl2-c1',
            kind: 'clash',
            side: 'red',
            coord: [103.30, 33.20],
            label: '包座全歼敌第49师',
            anim: [0.28, 0.65],
          },
          {
            id: 'gl2-c2',
            kind: 'clash',
            side: 'red',
            coord: [103.58, 34.13],
            label: '突破天险腊子口',
            anim: [0.42, 0.85],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════ 场景 6：乌蒙回旋与三大主力会师
  {
    id: 'sc-wumeng-huining',
    index: 6,
    shortTitle: '乌蒙回旋·大会师',
    title: '乌蒙山千里回旋 · 三大主力西北大会师',
    subtitle: '1936.02.21 — 10.22 · 甩开十万围堵渡金沙，会宁·将台堡胜利会师',
    from: '1936-02-21',
    to: '1936-10-22',
    redSide: { name: '红一、二、四方面军', strength: '三大主力北上会合' },
    enemySide: { name: '乌蒙五纵队 / 西北截击军', strength: '十余万人围追截击' },
    plotScale: 2.8,
    hydro: {},
    beats: [
      {
        id: 'wh-b1',
        from: '1936-02-21',
        to: '1936-04-05',
        dateLabel: '1936.02 — 03.30',
        title: '乌蒙山千里回旋 · 跳出五纵队合围',
        caption:
          '国民党军万耀煌、樊嵩甫等 5 个纵队十余万人合围镇雄、赫章、威宁；红二、六军团忽东忽西大回旋穿插，从敌结合部跳出重围。',
        camera: { center: [104.65, 26.85], zoom: 7.0 },
        focusLandmarks: ['lm-bijie', 'lm-weining'],
        graphics: [
          {
            id: 'wh1-ring',
            kind: 'markLine',
            side: 'enemy',
            path: [
              [103.95, 27.62],
              [103.82, 26.55],
              [105.05, 26.48],
              [105.55, 27.45],
              [103.95, 27.62],
            ],
            dashed: true,
            label: '国民党军 5 个纵队合围圈',
            anim: [0.0, 0.42],
          },
          {
            id: 'wh1-pincer',
            kind: 'pincer',
            side: 'enemy',
            start: [105.75, 26.82],
            end: [104.65, 27.08],
            style: { width: 4800, headWidth: 12500, headLength: 11500, spreadRatio: 0.48 },
            label: '十余万敌军向心合击',
            anim: [0.08, 0.58],
          },
          {
            id: 'wh1-loop',
            kind: 'arrow',
            side: 'red',
            path: [
              [105.28, 27.30],
              [104.72, 27.12],
              [104.28, 26.86],
              [104.10, 26.22],
              [104.47, 25.71],
            ],
            style: { width: 4800, headWidth: 13000, headLength: 12000, tailTaper: 0.48 },
            label: '红二、六军团千里回旋突围',
            anim: [0.22, 0.84],
          },
        ],
      },
      {
        id: 'wh-b2',
        from: '1936-09-05',
        to: '1936-10-22',
        dateLabel: '1936.09 — 10.22',
        title: '冲破静会封锁 · 会宁与将台堡大会师',
        caption:
          '红二、四方面军自甘孜共同北上，突破胡宗南、毛炳文部静会公路封锁线，与南下接应的红一方面军在会宁（10.9）、将台堡（10.22）胜利会师！',
        camera: { center: [105.55, 35.55], zoom: 6.75 },
        focusLandmarks: ['lm-jingning', 'lm-lanzhou'],
        graphics: [
          {
            id: 'wh2-block',
            kind: 'defense',
            side: 'enemy',
            path: [
              [104.45, 35.12],
              [106.05, 35.38],
            ],
            toothSize: 4800,
            toothSide: 1,
            label: '胡宗南·毛炳文静会公路封锁线',
            anim: [0.0, 0.40],
          },
          {
            id: 'wh2-r4',
            kind: 'arrow',
            side: 'red',
            path: [
              [104.35, 34.45],
              [105.24, 35.21],
              [105.05, 35.70],
            ],
            style: { width: 4800, headWidth: 13000, headLength: 11800, tailTaper: 0.5 },
            label: '红二、四方面军北上突围',
            anim: [0.14, 0.72],
          },
          {
            id: 'wh2-r1',
            kind: 'arrow',
            side: 'red',
            path: [
              [106.55, 36.45],
              [105.83, 35.85],
            ],
            style: { width: 4500, headWidth: 12000, headLength: 11000, tailTaper: 0.5 },
            label: '红一方面军南下接应',
            anim: [0.22, 0.78],
          },
          {
            id: 'wh2-clash',
            kind: 'clash',
            side: 'red',
            coord: [105.45, 35.78],
            label: '三大主力胜利大会师',
            anim: [0.40, 0.88],
          },
        ],
      },
    ],
  },
];

/** 节点详情中「一键推演对应战役动态场景」的映射（覆盖 21 个核心战役/会议/会师节点） */
export const NODE_SCENE_LINKS: Record<string, { sceneId: string; beatIndex: number; label: string }> = {
  'n-xiangjiang': { sceneId: 'sc-xiangjiang', beatIndex: 1, label: '演播「血战湘江 · 三大阻击战」动态态势' },
  'n-tongdao': { sceneId: 'sc-tongdao', beatIndex: 0, label: '演播「通道转兵 · 避开湘西口袋阵」动态态势' },
  'n-liping': { sceneId: 'sc-tongdao', beatIndex: 0, label: '演播「通道转兵 · 黎平定策入黔」动态态势' },
  'n-houchang': { sceneId: 'sc-tongdao', beatIndex: 1, label: '演播「强渡乌江 · 进军遵义」动态态势' },
  'n-wujiang': { sceneId: 'sc-tongdao', beatIndex: 1, label: '演播「强渡乌江天险」动态态势' },
  'n-zunyi': { sceneId: 'sc-chishui', beatIndex: 0, label: '演播「四渡赤水 · 四十万合围破局」动态态势' },
  'n-tucheng': { sceneId: 'sc-chishui', beatIndex: 0, label: '演播「土城战斗 · 一渡赤水」动态态势' },
  'n-zhaxi': { sceneId: 'sc-chishui', beatIndex: 0, label: '演播「一渡赤水 · 集结扎西」动态态势' },
  'n-loushan': { sceneId: 'sc-chishui', beatIndex: 1, label: '演播「二渡赤水 · 娄山关遵义大捷」动态态势' },
  'n-gouba': { sceneId: 'sc-chishui', beatIndex: 2, label: '演播「苟坝拒险 · 三渡赤水诱敌」动态态势' },
  'n-lubanchang': { sceneId: 'sc-chishui', beatIndex: 2, label: '演播「三渡赤水 · 诱敌西进川南」动态态势' },
  'n-jinsha': { sceneId: 'sc-jinsha-dadu', beatIndex: 0, label: '演播「佯逼昆明 · 巧渡金沙江」动态态势' },
  'n-yihai': { sceneId: 'sc-jinsha-dadu', beatIndex: 1, label: '演播「彝海结盟 · 强渡大渡河」动态态势' },
  'n-dadu': { sceneId: 'sc-jinsha-dadu', beatIndex: 1, label: '演播「安顺场强渡大渡河」动态态势' },
  'n-luding': { sceneId: 'sc-jinsha-dadu', beatIndex: 1, label: '演播「昼夜 240 里飞夺泸定桥」动态态势' },
  'n-jiajinshan': { sceneId: 'sc-grassland-lazikou', beatIndex: 0, label: '演播「翻越夹金山 · 懋功会师」动态态势' },
  'n-maogong': { sceneId: 'sc-grassland-lazikou', beatIndex: 0, label: '演播「懋功大会师与松潘受阻」动态态势' },
  'n-grassland': { sceneId: 'sc-grassland-lazikou', beatIndex: 1, label: '演播「穿越松潘草地」动态态势' },
  'n-baozuo': { sceneId: 'sc-grassland-lazikou', beatIndex: 1, label: '演播「包座大捷 · 打开甘南门户」动态态势' },
  'n-lazikou': { sceneId: 'sc-grassland-lazikou', beatIndex: 1, label: '演播「奇袭天险腊子口」动态态势' },
  'n-wumeng': { sceneId: 'sc-wumeng-huining', beatIndex: 0, label: '演播「乌蒙山千里回旋战」动态态势' },
  'n-huining': { sceneId: 'sc-wumeng-huining', beatIndex: 1, label: '演播「突破静会封锁 · 会宁大会师」动态态势' },
  'n-jiangtaibao': { sceneId: 'sc-wumeng-huining', beatIndex: 1, label: '演播「三大主力将台堡大会师」动态态势' },
};
