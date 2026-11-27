import type { LonLat } from './types';

/**
 * 战略参照重镇与战役战术要隘地标数据。
 *
 * 为什么需要独立于 StoryNode 的地标层：
 * StoryNode 只记录红军实际驻留或发生事件的节点；但读懂长征态势必须看到红军「佯攻、威逼、绕开或受阻」
 * 的关键战略支点——例如四渡赤水末段的「贵阳」（蒋介石驻节督战，红军兵临城下调出滇军）、
 * 巧渡金沙江前的「昆明」（佯逼省城调空江防）、一渡赤水前的「泸州/宜宾」（原定北渡长江目标）、
 * 过草地前的「松潘」（胡宗南重兵盘踞迫使红军改走沼泽）。
 */
export interface LandmarkSceneFocus {
  /** 在对应场景阶段激活时展示的战术说明 */
  note: string;
  /** 高亮角色：佯攻/奇袭目标 | 敌军重兵据点 | 战略参照支点 */
  tone: 'target' | 'fortress' | 'pivot';
}

export interface Landmark {
  id: string;
  name: string;
  coord: LonLat;
  /**
   * 比例尺分级：
   * - strategic: 省级/战区级战略重镇（zoom >= 5.45 中比例尺即显示；若被当前战役场景点名则跨级高亮）
   * - tactical:  战役渡口/关隘/集镇（zoom >= 6.75 大比例尺或对应战役激活时显示）
   */
  tier: 'strategic' | 'tactical';
  /** 平时悬停或中大比例尺下的简短定位说明 */
  brief?: string;
  /** 标签默认朝向 */
  anchor?: 'right' | 'left' | 'top' | 'bottom';
  /** 在特定战役场景 ID 下的动态高亮说明 */
  sceneFocus?: Record<string, LandmarkSceneFocus>;
}

export const landmarks: Landmark[] = [
  // ══════════════════════════════════════════════ 战略重镇（L2 中比例尺起显，场景内可跨级高亮）
  {
    id: 'lm-guiyang',
    name: '贵阳',
    coord: [106.71, 26.58],
    tier: 'strategic',
    brief: '贵州省会 · 四渡赤水末段蒋介石飞抵督战',
    anchor: 'right',
    sceneFocus: {
      'sc-chishui': {
        note: '蒋介石驻节督战 · 红军佯攻逼调滇军东援',
        tone: 'target',
      },
    },
  },
  {
    id: 'lm-kunming',
    name: '昆明',
    coord: [102.71, 25.04],
    tier: 'strategic',
    brief: '云南省会 · 红军一部佯逼省城调空金沙江防务',
    anchor: 'left',
    sceneFocus: {
      'sc-jinsha-dadu': {
        note: '佯逼省城 · 迫龙云回调民团致江防空虚',
        tone: 'target',
      },
    },
  },
  {
    id: 'lm-luzhou',
    name: '泸州',
    coord: [105.44, 28.89],
    tier: 'strategic',
    brief: '川南长江重镇 · 原定北渡长江目标之一',
    anchor: 'top',
    sceneFocus: {
      'sc-chishui': {
        note: '川军重兵封锁长江渡口',
        tone: 'fortress',
      },
    },
  },
  {
    id: 'lm-yibin',
    name: '宜宾',
    coord: [104.64, 28.77],
    tier: 'strategic',
    brief: '川南长江上游重镇 · 川军潘文华部江防据点',
    anchor: 'left',
    sceneFocus: {
      'sc-chishui': {
        note: '北渡长江原定方向（川军封锁）',
        tone: 'fortress',
      },
    },
  },
  {
    id: 'lm-chongqing',
    name: '重庆',
    coord: [106.55, 29.56],
    tier: 'strategic',
    brief: '国民党军参谋团与行营所在地',
    anchor: 'right',
  },
  {
    id: 'lm-chengdu',
    name: '成都',
    coord: [104.06, 30.67],
    tier: 'strategic',
    brief: '四川省会 · 川军刘湘大本营',
    anchor: 'right',
  },
  {
    id: 'lm-songpan',
    name: '松潘',
    coord: [103.60, 32.64],
    tier: 'strategic',
    brief: '川西北门户 · 胡宗南部重兵驻守迫使红军绕行草地',
    anchor: 'right',
    sceneFocus: {
      'sc-grassland-lazikou': {
        note: '胡宗南部主力扼守 · 封死北上大道',
        tone: 'fortress',
      },
    },
  },
  {
    id: 'lm-guilin',
    name: '桂林',
    coord: [110.29, 25.27],
    tier: 'strategic',
    brief: '桂军白崇禧指挥据点',
    anchor: 'left',
    sceneFocus: {
      'sc-xiangjiang': {
        note: '桂军指挥中枢 · 北上夹击湘江',
        tone: 'fortress',
      },
    },
  },
  {
    id: 'lm-hengyang',
    name: '衡阳',
    coord: [112.57, 26.89],
    tier: 'strategic',
    brief: '湘南重镇 · 湘军何键追剿军后方枢纽',
    anchor: 'right',
  },
  {
    id: 'lm-zhijiang',
    name: '芷江·洪江',
    coord: [109.75, 27.32],
    tier: 'strategic',
    brief: '湘西门户 · 何键五路重兵口袋阵中枢',
    anchor: 'right',
    sceneFocus: {
      'sc-tongdao': {
        note: '湘军五路约20万筑碉布袋阵',
        tone: 'fortress',
      },
    },
  },
  {
    id: 'lm-yaan',
    name: '雅安',
    coord: [103.00, 29.98],
    tier: 'strategic',
    brief: '川康门户 · 川军驰援泸定与百丈关基地',
    anchor: 'right',
    sceneFocus: {
      'sc-jinsha-dadu': {
        note: '川军西援泸定桥出发地',
        tone: 'fortress',
      },
    },
  },
  {
    id: 'lm-lanzhou',
    name: '兰州',
    coord: [103.83, 36.06],
    tier: 'strategic',
    brief: '甘肃省会 · 国民党西北“剿总”据点',
    anchor: 'left',
  },
  {
    id: 'lm-xian',
    name: '西安',
    coord: [108.94, 34.26],
    tier: 'strategic',
    brief: '西北重镇 · 东北军总部所在地',
    anchor: 'right',
  },

  // ══════════════════════════════════════════════ 战役战术要隘（L3 大比例尺或对应战役激活时显示）
  {
    id: 'lm-quanzhou',
    name: '全州',
    coord: [111.07, 25.93],
    tier: 'tactical',
    anchor: 'right',
    sceneFocus: { 'sc-xiangjiang': { note: '湘军刘建绪四个师南下起点', tone: 'fortress' } },
  },
  {
    id: 'lm-xingan',
    name: '兴安',
    coord: [110.67, 25.61],
    tier: 'tactical',
    anchor: 'left',
    sceneFocus: { 'sc-xiangjiang': { note: '湘桂走廊南端要冲', tone: 'pivot' } },
  },
  {
    id: 'lm-jieshou',
    name: '界首渡口',
    coord: [110.62, 25.83],
    tier: 'tactical',
    anchor: 'left',
    sceneFocus: { 'sc-xiangjiang': { note: '中央纵队强渡湘江主渡口', tone: 'target' } },
  },
  {
    id: 'lm-guanyang',
    name: '灌阳',
    coord: [111.16, 25.49],
    tier: 'tactical',
    anchor: 'right',
    sceneFocus: { 'sc-xiangjiang': { note: '桂军夏威部北攻新圩方向', tone: 'fortress' } },
  },
  {
    id: 'lm-tongzi',
    name: '桐梓',
    coord: [106.83, 28.13],
    tier: 'tactical',
    anchor: 'right',
    sceneFocus: { 'sc-chishui': { note: '娄山关北侧门户', tone: 'pivot' } },
  },
  {
    id: 'lm-maotai',
    name: '茅台渡口',
    coord: [106.38, 27.85],
    tier: 'tactical',
    anchor: 'right',
    sceneFocus: { 'sc-chishui': { note: '三渡赤水渡口（白天大张旗鼓渡河诱敌）', tone: 'pivot' } },
  },
  {
    id: 'lm-taipingdu',
    name: '太平渡·二郎滩',
    coord: [105.96, 28.31],
    tier: 'tactical',
    anchor: 'left',
    sceneFocus: { 'sc-chishui': { note: '二渡、四渡赤水关键渡口', tone: 'target' } },
  },
  {
    id: 'lm-gulin',
    name: '古蔺·叙永',
    coord: [105.62, 28.17],
    tier: 'tactical',
    anchor: 'bottom',
    sceneFocus: { 'sc-chishui': { note: '三渡后诱集国民党军主力扑空区', tone: 'pivot' } },
  },
  {
    id: 'lm-daguxinchang',
    name: '打鼓新场（金沙）',
    coord: [106.22, 27.46],
    tier: 'tactical',
    anchor: 'left',
    sceneFocus: { 'sc-chishui': { note: '苟坝会议力阻强攻之敌军坚城', tone: 'fortress' } },
  },
  {
    id: 'lm-xifeng',
    name: '息烽·乌江南岸',
    coord: [106.74, 27.09],
    tier: 'tactical',
    anchor: 'right',
    sceneFocus: { 'sc-chishui': { note: '四渡后南跃乌江跳板', tone: 'pivot' } },
  },
  {
    id: 'lm-qujing',
    name: '曲靖',
    coord: [103.79, 25.49],
    tier: 'tactical',
    anchor: 'bottom',
    sceneFocus: { 'sc-jinsha-dadu': { note: '入滇门户 · 截获金沙江渡口情报', tone: 'pivot' } },
  },
  {
    id: 'lm-xichang',
    name: '西昌',
    coord: [102.26, 27.89],
    tier: 'tactical',
    anchor: 'right',
    sceneFocus: { 'sc-jinsha-dadu': { note: '川康重镇 · 红军绕城疾进彝区', tone: 'fortress' } },
  },
  {
    id: 'lm-bijie',
    name: '毕节·镇雄',
    coord: [105.08, 27.36],
    tier: 'tactical',
    anchor: 'top',
    sceneFocus: { 'sc-wumeng-huining': { note: '红二、六军团乌蒙回旋出发轴心', tone: 'pivot' } },
  },
  {
    id: 'lm-weining',
    name: '威宁·赫章',
    coord: [104.45, 26.96],
    tier: 'tactical',
    anchor: 'left',
    sceneFocus: { 'sc-wumeng-huining': { note: '乌蒙山回旋突破口', tone: 'target' } },
  },
  {
    id: 'lm-jingning',
    name: '静宁·西吉',
    coord: [105.73, 35.51],
    tier: 'tactical',
    anchor: 'right',
    sceneFocus: { 'sc-wumeng-huining': { note: '突破静会封锁线会师通道', tone: 'pivot' } },
  },
];
