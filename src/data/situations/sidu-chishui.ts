import type { Situation } from '../types';

/**
 * 四渡赤水敌我态势（1935 年 1 月 19 日 — 4 月 1 日）。
 *
 * 兵力数据：中央红军 3.7 万余人；国民党军约 40 万人（《长征记》第八章）。
 * 双方部队番号、指挥关系据《长征记》第八、九章与《中国共产党历史》第一卷。
 *
 * 图形说明：所有标绘（箭头宽度、集结地半径）都是"示意量级"，
 * 目的是表达相对关系与运动方向，不代表实测正面宽度或实际控制范围。
 */
export const siduChishui: Situation = {
  id: 'sidu-chishui',
  title: '四渡赤水',
  subtitle: '1935 年 1 月 — 4 月 · 中央红军 3 万余人对国民党军 40 万人',
  period: { from: '1935-01-19', to: '1935-04-01' },
  camera: { center: [105.92, 28.16], zoom: 7.28, pitch: 0 },
  /** 战役级视图下把标绘放大到可读尺寸（真实千米量级 × 2.6） */
  plotScale: 2.6,
  detailTerrain: 'sidu',
  /** 战场地理参照点 */
  mapLabels: [
    { coord: [106.93, 27.70], text: '遵义' },
    { coord: [106.83, 28.13], text: '桐梓' },
    { coord: [106.02, 28.22], text: '土城' },
    { coord: [105.81, 28.18], text: '古蔺' },
    { coord: [105.05, 27.84], text: '扎西' },
    { coord: [106.38, 27.85], text: '茅台' },
    { coord: [105.98, 28.35], text: '太平渡' },
    { coord: [106.30, 27.66], text: '鲁班场' },
  ],
  summary:
    '遵义会议后，中央红军拟北渡长江与红四方面军会合，但在土城受阻。毛泽东随即改变计划，在川黔滇边界的赤水河上四次渡河，忽东忽西、声东击西，把国民党军 40 万人的合围圈一次次甩在身后，最终南渡乌江、兵临贵阳，调出滇军，从容西进云南。这是中国军事史上机动战例的典范。',
  confidence: 'high',
  source: [
    {
      title: '《长征记》第八章「四渡赤水（上）」、第九章「四渡赤水（下）」',
      publisher: '曲爱国、张从田著，华夏出版社 2016',
      url: 'http://dangshi.people.com.cn/GB/146570/406330/index.html',
    },
    {
      title: '长征概况',
      publisher: '中国青年网（国际在线转载）',
      url: 'https://news.cri.cn/2016-07-27/2d0bbc15-6916-67ad-c980-4ab278e233e5.html',
    },
  ],
  sides: [
    {
      id: 'red',
      name: '中国工农红军第一方面军（中央红军）',
      strength: '3.7 万余人',
      commander: '毛泽东、周恩来、朱德、王稼祥（新三人团）',
      units: [
        { name: '红一军团', note: '林彪、聂荣臻' },
        { name: '红三军团', note: '彭德怀、杨尚昆' },
        { name: '红五军团', note: '董振堂、李卓然' },
        { name: '红九军团', note: '罗炳辉、蔡树藩' },
        { name: '军委纵队', note: '中央机关与直属队' },
      ],
    },
    {
      id: 'enemy',
      name: '国民党军“追剿”部队',
      strength: '约 40 万人',
      commander: '蒋介石（重庆行营）统筹；薛岳前敌总指挥',
      units: [
        { name: '中央军薛岳兵团', strength: '周浑元纵队、吴奇伟纵队', note: '尾追主力' },
        { name: '川军刘湘部', strength: '潘文华南路、郭勋祺模范师等', note: '沿长江南岸堵截' },
        { name: '滇军孙渡纵队', strength: '3 个旅', note: '防红军西入云南' },
        { name: '黔军王家烈部', strength: '3 个师', note: '扼守黔北要地' },
        { name: '湘军何键部', strength: '李韫珩、李云杰等部', note: '封锁乌江东岸' },
      ],
    },
  ],
  phases: [
    {
      id: 'p0',
      date: '1935-01-19',
      title: '合肥压境：四十万对三万七',
      narrative:
        '1935 年 1 月 19 日，蒋介石下达《长江南岸围剿计划》，企图把中央红军压迫于川江南岸“合剿而聚歼之”。参与合围的国民党军约 40 万人，而中央红军只有 3.7 万余人，兵力对比不足 1:10。\n\n北面是长江与川军，东面是湘军，南面是薛岳的中央军，西面是滇军。红军被围在黔北一隅。',
      graphics: [
        // 敌：川军沿长江南岸布防
        {
          id: 'p0-e-chuan',
          kind: 'defense',
          side: 'enemy',
          path: [
            [104.63, 28.77],
            [105.44, 28.87],
            [105.83, 28.81],
            [106.65, 29.03],
          ],
          toothSize: 5000,
          toothSide: -1,
          label: '川军 潘文华部（沿长江南岸布防）',
        },
        // 敌：中央军自南向北压
        {
          id: 'p0-e-central',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [106.90, 26.95],
            [106.88, 27.30],
            [106.86, 27.52],
          ],
          style: { width: 9000, headWidth: 24000, headLength: 22000, tailTaper: 0.7 },
          label: '中央军 薛岳兵团（周浑元、吴奇伟纵队）',
        },
        // 敌：滇军自西向东
        {
          id: 'p0-e-dian',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [103.72, 27.34],
            [104.40, 27.42],
            [104.90, 27.50],
          ],
          style: { width: 7000, headWidth: 19000, headLength: 18000, tailTaper: 0.7 },
          label: '滇军 孙渡纵队',
        },
        // 敌：湘军封锁乌江
        {
          id: 'p0-e-xiang',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [108.20, 27.95],
            [107.60, 27.70],
            [107.20, 27.50],
          ],
          style: { width: 7000, headWidth: 19000, headLength: 18000, tailTaper: 0.7 },
          label: '湘军 何键部',
        },
        // 红军集结
        {
          id: 'p0-r-assemble',
          kind: 'assemble',
          side: 'red',
          center: [106.93, 27.70],
          radiusX: 26000,
          radiusY: 18000,
          rotation: 15,
          label: '中央红军 3.7 万余人',
        },
        {
          id: 'p0-label',
          kind: 'text',
          side: 'red',
          coord: [106.93, 27.52],
          text: '遵义',
          size: 15,
        },
      ],
    },
    {
      id: 'p1',
      date: '1935-01-29',
      title: '一渡赤水：土城受阻，西入川南',
      narrative:
        '1 月 28 日，红军在土城青杠坡与川军郭勋祺部遭遇。因情报有误（原判四个团，实为六个团且不断增援），红军久战不克，伤亡较大。\n\n毛泽东当机立断：撤出战斗，1 月 29 日从土城、元厚西渡赤水河，进入四川古蔺、叙永地区，随后集结于云南扎西（威信）整编。北渡长江的原定计划暂时搁置。',
      graphics: [
        // 红军北上受阻
        {
          id: 'p1-r-north',
          kind: 'arrow',
          side: 'red',
          path: [
            [106.93, 27.70],
            [106.83, 28.13],
            [106.30, 28.22],
            [106.02, 28.22],
          ],
          style: { width: 5200, headWidth: 14000, headLength: 13000, tailTaper: 0.55 },
          label: '红军北上受阻于土城',
        },
        // 一渡箭头
        {
          id: 'p1-r-cross',
          kind: 'arrow',
          side: 'red',
          path: [
            [106.02, 28.22],
            [105.90, 28.33],
            [105.81, 28.18],
            [105.44, 28.16],
          ],
          style: { width: 5200, headWidth: 15000, headLength: 14000, tailTaper: 0.5 },
          label: '① 一渡赤水（1.29 土城、元厚）',
        },
        // 红军至扎西
        {
          id: 'p1-r-zhaxi',
          kind: 'arrow',
          side: 'red',
          path: [
            [105.44, 28.16],
            [105.20, 28.00],
            [105.05, 27.84],
          ],
          style: { width: 4800, headWidth: 13000, headLength: 12000, tailTaper: 0.5 },
          label: '集结扎西整编',
        },
        // 敌：川军南下截击
        {
          id: 'p1-e-chuan',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [105.44, 28.87],
            [105.40, 28.50],
            [105.42, 28.26],
          ],
          style: { width: 7000, headWidth: 19000, headLength: 17000, tailTaper: 0.7 },
          label: '川军 郭勋祺部',
        },
        // 敌：中央军追击
        {
          id: 'p1-e-central',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [106.90, 27.05],
            [106.70, 27.55],
            [106.35, 27.85],
          ],
          style: { width: 8000, headWidth: 21000, headLength: 19000, tailTaper: 0.7 },
          label: '中央军 周浑元纵队（尾追）',
        },
        {
          id: 'p1-r-assemble',
          kind: 'assemble',
          side: 'red',
          center: [105.05, 27.84],
          radiusX: 24000,
          radiusY: 16000,
          rotation: -20,
          label: '红军主力集结扎西',
        },
      ],
    },
    {
      id: 'p2',
      date: '1935-02-18',
      title: '二渡赤水：回师黔北，娄山关大捷',
      narrative:
        '当国民党军主力被吸引到川滇边时，红军于 2 月 18 日至 21 日从太平渡、二郎滩东渡赤水（二渡），突然回师黔北。\n\n24 日夺桐梓，25 日至 26 日攻占娄山关，28 日再占遵义，随后击溃增援的吴奇伟纵队。此役共歼敌两个师又八个团，俘敌约三千人，是长征以来最大的一次胜利。',
      graphics: [
        // 二渡
        {
          id: 'p2-r-cross',
          kind: 'arrow',
          side: 'red',
          path: [
            [105.05, 27.84],
            [105.60, 28.10],
            [105.92, 28.26],
            [105.98, 28.35],
          ],
          style: { width: 5200, headWidth: 15000, headLength: 14000, tailTaper: 0.45 },
          label: '② 二渡赤水（2.18—21 太平渡、二郎滩）',
        },
        // 回师
        {
          id: 'p2-r-east',
          kind: 'arrow',
          side: 'red',
          path: [
            [105.98, 28.35],
            [106.40, 28.30],
            [106.83, 28.13],
            [106.83, 28.00],
            [106.93, 27.70],
          ],
          style: { width: 5200, headWidth: 14000, headLength: 13000, tailTaper: 0.5 },
          label: '回师黔北：桐梓—娄山关—遵义',
        },
        // 钳击遵义
        {
          id: 'p2-r-pincer',
          kind: 'pincer',
          side: 'red',
          start: [106.83, 28.02],
          end: [106.93, 27.70],
          style: { width: 3600, headWidth: 11000, headLength: 10000, spreadRatio: 0.5 },
          label: '娄山关大捷（2.25—26）',
        },
        // 敌：吴奇伟增援被击溃
        {
          id: 'p2-e-wuqiwei',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [107.05, 27.05],
            [107.00, 27.35],
            [106.97, 27.55],
          ],
          style: { width: 6500, headWidth: 18000, headLength: 16000, tailTaper: 0.7 },
          label: '中央军 吴奇伟纵队（增援被击溃）',
        },
        // 敌：黔军
        {
          id: 'p2-e-qianjun',
          kind: 'block',
          side: 'enemy',
          center: [106.83, 28.00],
          size: 9000,
          rotation: 0,
          label: '黔军 王家烈部扼守娄山关',
        },
      ],
    },
    {
      id: 'p3',
      date: '1935-03-16',
      title: '三渡赤水：大张旗鼓，诱敌西进',
      narrative:
        '再占遵义后，红军于 3 月 15 日进攻鲁班场的周浑元纵队，激战终日未克。毛泽东随即改换计划：16 日至 17 日从茅台西渡赤水（三渡），并故意大张旗鼓、白天渡河，让国民党军看清红军动向。\n\n蒋介石果然判断红军又要北渡长江，急令各路大军向川南古蔺、叙永地区合围。',
      graphics: [
        // 攻鲁班场
        {
          id: 'p3-r-luban',
          kind: 'arrow',
          side: 'red',
          path: [
            [106.93, 27.70],
            [106.66, 27.62],
            [106.30, 27.66],
          ],
          style: { width: 4600, headWidth: 13000, headLength: 11000, tailTaper: 0.5 },
          label: '红军攻鲁班场（3.15 未克）',
        },
        // 三渡
        {
          id: 'p3-r-cross',
          kind: 'arrow',
          side: 'red',
          path: [
            [106.30, 27.66],
            [106.38, 27.85],
            [106.05, 28.02],
            [105.81, 28.18],
          ],
          style: { width: 5600, headWidth: 16000, headLength: 15000, tailTaper: 0.45 },
          label: '③ 三渡赤水（3.16—17 茅台，白天渡河）',
        },
        // 敌军大举西进
        {
          id: 'p3-e-central',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [107.30, 27.30],
            [106.60, 27.55],
            [105.95, 27.70],
          ],
          style: { width: 9000, headWidth: 24000, headLength: 22000, tailTaper: 0.75 },
          label: '中央军主力西进合围',
        },
        {
          id: 'p3-e-chuan',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [105.83, 28.81],
            [105.80, 28.50],
            [105.81, 28.24],
          ],
          style: { width: 7500, headWidth: 20000, headLength: 18000, tailTaper: 0.7 },
          label: '川军南下堵截',
        },
        {
          id: 'p3-e-dian',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [104.20, 27.55],
            [104.70, 27.75],
            [105.00, 27.90],
          ],
          style: { width: 7000, headWidth: 19000, headLength: 17000, tailTaper: 0.7 },
          label: '滇军东进',
        },
        {
          id: 'p3-label',
          kind: 'text',
          side: 'enemy',
          coord: [105.30, 28.30],
          text: '国民党军主力被吸引至川南',
          size: 13,
        },
      ],
    },
    {
      id: 'p4',
      date: '1935-03-21',
      title: '四渡赤水：秘密东返，南渡乌江',
      narrative:
        '当国民党军主力全部被吸引到川南时，红军于 3 月 21 日至 22 日夜，秘密地从二郎滩、太平渡、九溪口东渡赤水（四渡），随即南下，31 日南渡乌江，直逼贵阳。\n\n正在贵阳督战的蒋介石急调滇军东援，红军却虚晃一枪，西进云南，把几十万追兵彻底甩在身后。',
      graphics: [
        // 四渡
        {
          id: 'p4-r-cross',
          kind: 'arrow',
          side: 'red',
          path: [
            [105.81, 28.18],
            [105.92, 28.26],
            [105.98, 28.35],
          ],
          style: { width: 5200, headWidth: 15000, headLength: 13000, tailTaper: 0.45 },
          label: '④ 四渡赤水（3.21—22 夜间秘密东渡）',
        },
        // 南下
        {
          id: 'p4-r-south',
          kind: 'arrow',
          side: 'red',
          path: [
            [105.98, 28.35],
            [106.40, 28.00],
            [106.85, 27.62],
            [106.22, 27.46],
            [106.79, 27.16],
          ],
          style: { width: 5600, headWidth: 16000, headLength: 15000, tailTaper: 0.5 },
          label: '南渡乌江（3.31），兵临贵阳',
        },
        // 红军佯攻贵阳
        {
          id: 'p4-r-guiyang',
          kind: 'arrow',
          side: 'red',
          path: [
            [106.79, 27.16],
            [106.72, 26.90],
            [106.72, 26.72],
          ],
          style: { width: 4200, headWidth: 12000, headLength: 11000, tailTaper: 0.5 },
          label: '佯攻贵阳',
        },
        // 敌：主力扑空
        {
          id: 'p4-e-main',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [106.90, 27.72],
            [106.40, 27.92],
            [105.90, 28.10],
          ],
          style: { width: 9500, headWidth: 25000, headLength: 22000, tailTaper: 0.75 },
          label: '国民党军主力扑向川南（扑空）',
        },
        {
          id: 'p4-label',
          kind: 'text',
          side: 'red',
          coord: [106.55, 28.32],
          text: '四渡之后：敌军主力尽在川南，红军已跳出合围',
          size: 13,
        },
      ],
    },
  ],
};

/** 赤水河与乌江走向（态势图底纹水系，示意） */
export const chishuiHydrography = {
  chishui: [
    [104.87, 27.44],
    [105.12, 27.42],
    [105.30, 27.42],
    [105.72, 27.44],
    [106.10, 27.52],
    [106.22, 27.46],
    [106.38, 27.85],
    [106.15, 28.15],
    [106.02, 28.22],
    [105.70, 28.58],
    [105.83, 28.81],
  ] as [number, number][],
  wujiang: [
    [106.35, 26.90],
    [106.62, 27.05],
    [106.79, 27.16],
    [106.95, 27.36],
    [107.40, 27.62],
    [108.20, 27.90],
  ] as [number, number][],
  changjiang: [
    [104.63, 28.77],
    [105.44, 28.87],
    [105.83, 28.81],
    [106.40, 29.10],
    [106.65, 29.03],
  ] as [number, number][],
};
