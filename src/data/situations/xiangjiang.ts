import type { Situation } from '../types';

/**
 * 湘江战役敌我态势（1934 年 11 月 25 日 — 12 月 1 日）。
 *
 * 兵力：中央红军出发时 8.6 万余人，此役后锐减至 3 万余人。
 * 国民党军投入湘军、桂军、中央军共约 30 个团，依托第四道封锁线在湘江两岸夹击。
 * 数据来源见 docs/01-data-sources.md。
 *
 * 标绘量级：本战役在 8.7 级视图下阅读（1 像素 ≈ 340 米），因此箭头宽度取
 * 3~5 公里的真实战术正面量级（一个师的进攻正面通常 3~5 km），不加额外放大系数。
 */
export const xiangjiang: Situation = {
  id: 'xiangjiang',
  title: '湘江战役',
  subtitle: '1934 年 11 月 25 日 — 12 月 1 日 · 中央红军 8.6 万 → 3 万余人',
  period: { from: '1934-11-25', to: '1934-12-01' },
  camera: { center: [110.92, 25.70], zoom: 8.5, pitch: 0 },
  detailTerrain: 'xiangjiang',
  /** 战场地理参照点 */
  mapLabels: [
    { coord: [111.07, 25.93], text: '全州' },
    { coord: [110.67, 25.61], text: '兴安' },
    { coord: [110.62, 25.83], text: '界首渡口' },
    { coord: [111.16, 25.49], text: '灌阳' },
    { coord: [111.60, 25.53], text: '道县' },
  ],
  summary:
    '红军自赣南突围后连续突破三道封锁线，蒋介石在湘江东岸布下第四道封锁线，调集湘军、桂军与中央军约 30 个团，企图把红军歼灭于湘江以东。红军以甬道式行军携大量辎重，行动迟缓，被迫在广西全州至兴安间 30 公里宽的正面强渡。11 月 27 日至 12 月 1 日，红一军团在脚山铺、红三军团在光华铺、红五师在新圩展开三大阻击战，以极大代价掩护中央纵队过江。战役后中央红军由出发时的 8.6 万余人锐减至 3 万余人，是长征中最惨烈的一役。',
  confidence: 'high',
  source: [
    {
      title: '《长征记》第二章「血战湘江」',
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
      name: '中国工农红军第一方面军',
      strength: '8.6 万余人（战后 3 万余人）',
      commander: '博古、李德、周恩来、朱德',
      units: [
        { name: '红一军团', note: '林彪、聂荣臻 · 脚山铺阻击' },
        { name: '红三军团', note: '彭德怀、杨尚昆 · 光华铺阻击' },
        { name: '红五军团', note: '董振堂 · 新圩阻击，红三十四师殿后' },
        { name: '红八、红九军团', note: '随中央纵队行动' },
        { name: '军委第一、第二纵队', note: '中央机关，携大量辎重' },
      ],
    },
    {
      id: 'enemy',
      name: '国民党军第四道封锁线部队',
      strength: '约 30 个团',
      commander: '蒋介石统筹；何键（追剿军总司令）、白崇禧（桂军）',
      units: [
        { name: '湘军刘建绪部', note: '由全州沿湘江南下，主攻脚山铺' },
        { name: '湘军李觉部', note: '向界首方向推进' },
        { name: '桂军夏威第 15 军', note: '由灌阳方向攻新圩' },
        { name: '桂军廖磊第 7 军', note: '攻光华铺、兴安' },
        { name: '中央军周浑元、吴奇伟纵队', note: '自东向西尾追' },
      ],
    },
  ],
  phases: [
    {
      id: 'xj-p0',
      date: '1934-11-25',
      title: '决心抢渡：三十公里宽的生死口',
      narrative:
        '11 月 25 日，中革军委决定中央红军从广西全州、兴安之间西渡湘江。此处江面是湘江上游，水浅可涉，但正面只有约 30 公里宽，两侧是湘军与桂军的重兵。\n\n红军此时已连续突破三道封锁线，减员两万两千人，部队极度疲惫；加上携带着印钞机、X 光机与大量辎重的甬道式行军，全军在湘桂边界的山道上拉成一条长达数十公里的纵队，首尾不能相顾。',
      graphics: [
        {
          id: 'xj-p0-r-assemble',
          kind: 'assemble',
          side: 'red',
          center: [111.22, 25.58],
          radiusX: 14000,
          radiusY: 9000,
          rotation: 15,
          label: '中央红军 8.6 万余人（甬道式行军）',
        },
        {
          id: 'xj-p0-r-arrow',
          kind: 'arrow',
          side: 'red',
          path: [
            [111.55, 25.54],
            [111.24, 25.62],
            [111.02, 25.70],
            [110.84, 25.78],
          ],
          style: { width: 3200, headWidth: 7600, headLength: 6800, tailTaper: 0.6 },
          label: '向湘江急进',
        },
        // 敌：湘军自全州南下
        {
          id: 'xj-p0-e-xiang',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.05, 25.92],
            [111.00, 25.86],
            [110.95, 25.80],
          ],
          style: { width: 4800, headWidth: 11000, headLength: 9500, tailTaper: 0.72 },
          label: '湘军 刘建绪部',
        },
        {
          id: 'xj-p0-e-li',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.02, 26.02],
            [110.86, 25.94],
            [110.72, 25.88],
          ],
          style: { width: 3600, headWidth: 8600, headLength: 7600, tailTaper: 0.72 },
          label: '湘军 李觉部',
        },
        // 敌：桂军自南向北
        {
          id: 'xj-p0-e-gui1',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.04, 25.42],
            [110.98, 25.54],
            [110.93, 25.66],
          ],
          style: { width: 4200, headWidth: 9800, headLength: 8500, tailTaper: 0.72 },
          label: '桂军 夏威第 15 军',
        },
        {
          id: 'xj-p0-e-gui2',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [110.52, 25.42],
            [110.60, 25.54],
            [110.66, 25.66],
          ],
          style: { width: 3800, headWidth: 9000, headLength: 8000, tailTaper: 0.72 },
          label: '桂军 廖磊第 7 军',
        },
        // 敌：中央军尾追
        {
          id: 'xj-p0-e-central',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.78, 25.56],
            [111.62, 25.60],
            [111.48, 25.64],
          ],
          style: { width: 4000, headWidth: 9400, headLength: 8200, tailTaper: 0.72 },
          label: '中央军 周浑元、吴奇伟纵队（尾追）',
        },
        {
          id: 'xj-p0-fort',
          kind: 'defense',
          side: 'enemy',
          path: [
            [110.98, 25.93],
            [110.80, 25.88],
            [110.62, 25.90],
          ],
          toothSize: 2400,
          toothSide: -1,
          label: '第四道封锁线（湘江东岸）',
        },
      ],
    },
    {
      id: 'xj-p1',
      date: '1934-11-27',
      title: '抢占渡口：界首、脚山铺、光华铺',
      narrative:
        '11 月 27 日，红一军团第二师第四团抢占界首渡口，红一军团主力夺取全州以南的脚山铺；红三军团进抵光华铺、新圩一带，向兴安方向警戒。\n\n红军抢到了渡口，但代价是兵力被拉成了三块：一军团在北、三军团在南、中央纵队还在东岸的队尾。这道「门」打开的同时，两侧的敌人已经压了上来。',
      graphics: [
        {
          id: 'xj-p1-r-yijun',
          kind: 'arrow',
          side: 'red',
          path: [
            [111.16, 25.66],
            [111.04, 25.72],
            [110.94, 25.78],
          ],
          style: { width: 2800, headWidth: 6600, headLength: 6000, tailTaper: 0.55 },
          label: '红一军团 → 脚山铺',
        },
        {
          id: 'xj-p1-r-sanjun',
          kind: 'arrow',
          side: 'red',
          path: [
            [111.06, 25.56],
            [110.88, 25.63],
            [110.68, 25.72],
          ],
          style: { width: 2800, headWidth: 6600, headLength: 6000, tailTaper: 0.55 },
          label: '红三军团 → 光华铺',
        },
        {
          id: 'xj-p1-r-jieshou',
          kind: 'arrow',
          side: 'red',
          path: [
            [110.95, 25.72],
            [110.80, 25.78],
            [110.64, 25.83],
          ],
          style: { width: 2400, headWidth: 5800, headLength: 5200, tailTaper: 0.5 },
          label: '抢占界首渡口（11.27）',
        },
        {
          id: 'xj-p1-r-xinxu',
          kind: 'block',
          side: 'red',
          center: [110.99, 25.45],
          size: 5200,
          rotation: 20,
          label: '红五师 → 新圩',
        },
        {
          id: 'xj-p1-e-xiang',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.08, 25.91],
            [111.01, 25.85],
            [110.95, 25.80],
          ],
          style: { width: 5200, headWidth: 12000, headLength: 10000, tailTaper: 0.72 },
          label: '湘军 刘建绪部（四个师）',
        },
        {
          id: 'xj-p1-e-gui',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.06, 25.40],
            [111.01, 25.50],
            [110.97, 25.60],
          ],
          style: { width: 4400, headWidth: 10000, headLength: 8800, tailTaper: 0.72 },
          label: '桂军 夏威部',
        },
      ],
    },
    {
      id: 'xj-p2',
      date: '1934-11-29',
      title: '三大阻击战：脚山铺 · 光华铺 · 新圩',
      narrative:
        '11 月 29 日起，三个方向同时打响。脚山铺，红一军团两个师在十余里宽的丘陵上顶住湘军四个师的轮番冲击；光华铺，红三军团第四师在开阔地上以肉搏反复夺回阵地；新圩，红五师以一个师对抗桂军两个师，阵地反复易手，伤亡过半。\n\n三道阻击线像三根钉子，把敌人钉在渡口之外，但每根钉子都在被一点点磨平。',
      graphics: [
        {
          id: 'xj-p2-r-jiaoshan',
          kind: 'defense',
          side: 'red',
          path: [
            [110.99, 25.82],
            [110.94, 25.78],
            [110.89, 25.74],
          ],
          toothSize: 2600,
          toothSide: -1,
          label: '脚山铺阻击（红一军团）',
        },
        {
          id: 'xj-p2-r-guanghua',
          kind: 'defense',
          side: 'red',
          path: [
            [110.71, 25.76],
            [110.67, 25.72],
            [110.64, 25.68],
          ],
          toothSize: 2500,
          toothSide: 1,
          label: '光华铺阻击（红三军团四师）',
        },
        {
          id: 'xj-p2-r-xinxu',
          kind: 'defense',
          side: 'red',
          path: [
            [111.03, 25.48],
            [110.99, 25.44],
            [110.95, 25.41],
          ],
          toothSize: 2500,
          toothSide: 1,
          label: '新圩阻击（红五师）',
        },
        {
          id: 'xj-p2-e-xiang',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.10, 25.90],
            [111.03, 25.84],
            [110.97, 25.79],
          ],
          style: { width: 5600, headWidth: 13000, headLength: 10500, tailTaper: 0.75 },
          label: '湘军 刘建绪部（四个师猛攻）',
        },
        {
          id: 'xj-p2-e-gui1',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [111.08, 25.38],
            [111.02, 25.44],
            [110.97, 25.49],
          ],
          style: { width: 4600, headWidth: 10500, headLength: 9000, tailTaper: 0.75 },
          label: '桂军 夏威部（攻新圩）',
        },
        {
          id: 'xj-p2-e-gui2',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [110.50, 25.38],
            [110.57, 25.50],
            [110.64, 25.63],
          ],
          style: { width: 4200, headWidth: 9600, headLength: 8200, tailTaper: 0.75 },
          label: '桂军 廖磊部（攻光华铺）',
        },
      ],
    },
    {
      id: 'xj-p3',
      date: '1934-12-01',
      title: '过江与断后：八万六到三万',
      narrative:
        '12 月 1 日，中央纵队与红军主力终于渡过湘江，突破了第四道封锁线。但担任全军后卫的红五军团第三十四师被阻断在湘江东岸，陷入重围，几乎全部牺牲；师长陈树湘负伤被俘后，在担架上扯断肠子自尽。\n\n湘江两岸尸横遍野，江水为之赤。此役之后，中央红军由出发时的 8.6 万余人锐减至 3 万余人。全军上下对错误路线的怀疑，也从这一刻起再也压不住了。',
      graphics: [
        {
          id: 'xj-p3-r-cross',
          kind: 'arrow',
          side: 'red',
          path: [
            [110.92, 25.80],
            [110.78, 25.82],
            [110.64, 25.83],
            [110.56, 25.78],
          ],
          style: { width: 3800, headWidth: 9000, headLength: 7800, tailTaper: 0.55 },
          label: '主力西渡湘江（12.1）',
        },
        {
          id: 'xj-p3-r-west',
          kind: 'arrow',
          side: 'red',
          path: [
            [110.56, 25.78],
            [110.44, 25.68],
            [110.34, 25.58],
          ],
          style: { width: 3200, headWidth: 7600, headLength: 6600, tailTaper: 0.5 },
          label: '向越城岭（老山界）转移',
        },
        {
          id: 'xj-p3-r-rear',
          kind: 'block',
          side: 'red',
          center: [111.06, 25.62],
          size: 6200,
          rotation: 0,
          label: '红三十四师被阻江东（全军覆没）',
        },
        {
          id: 'xj-p3-e-close',
          kind: 'pincer',
          side: 'enemy',
          start: [111.18, 25.50],
          end: [110.99, 25.66],
          style: { width: 2600, headWidth: 6800, headLength: 6000, spreadRatio: 0.55 },
          label: '湘军、桂军合击江东红军',
        },
        {
          id: 'xj-p3-label',
          kind: 'text',
          side: 'enemy',
          coord: [110.88, 25.95],
          text: '战役后：中央红军 8.6 万 → 3 万余人',
          size: 13,
        },
      ],
    },
  ],
};

/** 湘江与相关水系走向（示意） */
export const xiangjiangHydrography: Record<string, [number, number][]> = {
  xiangjiang: [
    [111.10, 25.96],
    [110.98, 25.90],
    [110.86, 25.86],
    [110.66, 25.84],
    [110.60, 25.74],
    [110.66, 25.62],
    [110.52, 25.50],
    [110.34, 25.42],
  ],
  zishui: [
    [111.42, 26.30],
    [111.25, 26.10],
    [111.10, 25.95],
  ],
};
