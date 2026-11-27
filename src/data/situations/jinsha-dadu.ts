import type { Situation } from '../types';

/**
 * 巧渡金沙江 · 强渡大渡河 · 飞夺泸定桥敌我态势（1935 年 4 月 9 日 — 6 月 2 日）。
 *
 * 史实依据：《长征记》第十、十一章，《中国共产党历史》第一卷。
 */
export const jinshaDadu: Situation = {
  id: 'jinsha-dadu',
  title: '巧渡金沙江 · 飞夺泸定桥',
  subtitle: '1935 年 4 月 — 6 月 · 调虎离山渡金沙，绝境奇兵越天险',
  period: { from: '1935-04-09', to: '1935-06-02' },
  camera: { center: [102.95, 27.65], zoom: 6.35, pitch: 0 },
  plotScale: 3.4,
  mapLabels: [
    { coord: [106.72, 26.65], text: '贵阳' },
    { coord: [102.71, 25.04], text: '昆明' },
    { coord: [102.31, 26.47], text: '皎平渡' },
    { coord: [102.25, 26.66], text: '会理' },
    { coord: [102.15, 28.32], text: '彝海' },
    { coord: [102.30, 29.20], text: '安顺场' },
    { coord: [102.23, 29.91], text: '泸定桥' },
    { coord: [103.00, 29.98], text: '雅安' },
    { coord: [102.85, 26.62], text: '金沙江' },
    { coord: [102.58, 29.28], text: '大渡河' },
  ],
  summary:
    '南渡乌江后，毛泽东导演“佯攻贵阳、调出滇军”的妙棋，乘云南后方空虚直插金沙江，仅凭 7 只木船在皎平渡从容北渡，甩开数十万追兵。随后通过彝区，在安顺场由十七勇士强渡大渡河打开缺口，红四团一昼夜急行军 240 里飞夺泸定桥，粉碎了蒋介石企图让红军成为“石达开第二”的迷梦。',
  confidence: 'high',
  source: [
    {
      title: '《长征记》第十章「巧渡金沙江」、第十一章「飞夺泸定桥」',
      publisher: '曲爱国、张从田著，华夏出版社 2016',
      url: 'http://dangshi.people.com.cn/GB/146570/406330/index.html',
    },
    {
      title: '《中国共产党历史》第一卷',
      publisher: '中共中央党史研究室著，中共党史出版社',
      url: 'https://www.qstheory.cn/books/2019-07/31/c_1119408590_12.htm',
    },
  ],
  sides: [
    {
      id: 'red',
      name: '中国工农红军第一方面军',
      strength: '约 3 万余人',
      commander: '毛泽东、周恩来、朱德、王稼祥、刘伯承',
      units: [
        { name: '军委干部团', note: '陈赓、宋任穷 · 抢占皎平渡口' },
        { name: '红一军团一师一团', note: '杨得志、黎林 · 安顺场十七勇士强渡' },
        { name: '红一军团二师四团', note: '王开湘、杨成武 · 240 里奔袭飞夺泸定桥' },
        { name: '红三、五、九军团', note: '分路掩护与殿后阻击' },
      ],
    },
    {
      id: 'enemy',
      name: '国民党军追堵部队',
      strength: '数十万人',
      commander: '蒋介石（贵阳、昆明督战）；薛岳、刘湘、刘文辉、龙云',
      units: [
        { name: '中央军薛岳兵团', note: '吴奇伟、周浑元纵队自黔入滇尾追' },
        { name: '滇军孙渡纵队', note: '被调往贵阳救援，反落红军身后' },
        { name: '川军刘湘部', note: '沿金沙江北岸、会理及大渡河东岸堵截' },
        { name: '川康军刘文辉第24军', note: '布防安顺场至泸定大渡河一线' },
      ],
    },
  ],
  phases: [
    {
      id: 'jd-p0',
      date: '1935-04-09',
      title: '佯攻贵阳：调出滇军，乘虚入滇',
      narrative:
        '毛泽东曾说：“只要能将滇军调出来，就是胜利。”4 月初红军逼近贵阳东郊，正在贵阳城内督战的蒋介石惊恐万状，急令滇军孙渡纵队兼程东援贵阳。\n\n滇军一动，云南门户洞开。红军立即从贵阳、龙里之间穿过湘黔公路，以日行百里的速度向西疾进云南，把滇军与薛岳追兵统统甩在身后。',
      graphics: [
        {
          id: 'jd-p0-r-feint',
          kind: 'arrow',
          side: 'red',
          path: [
            [106.79, 27.16],
            [106.72, 26.75],
          ],
          style: { width: 4200, headWidth: 11000, headLength: 10000, tailTaper: 0.5 },
          label: '佯攻贵阳',
        },
        {
          id: 'jd-p0-r-west',
          kind: 'arrow',
          side: 'red',
          path: [
            [106.66, 26.45],
            [105.19, 25.43],
            [103.79, 25.49],
          ],
          style: { width: 5800, headWidth: 15000, headLength: 14000, tailTaper: 0.5 },
          label: '主力乘虚疾进云南',
        },
        {
          id: 'jd-p0-e-dian',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [104.20, 25.95],
            [105.60, 26.35],
            [106.45, 26.58],
          ],
          style: { width: 6500, headWidth: 17000, headLength: 15000, tailTaper: 0.7 },
          label: '滇军孙渡纵队东援贵阳（被调虎离山）',
        },
        {
          id: 'jd-p0-e-xue',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [106.85, 27.55],
            [106.15, 26.85],
          ],
          style: { width: 7200, headWidth: 19000, headLength: 17000, tailTaper: 0.7 },
          label: '中央军薛岳部南下尾追',
        },
      ],
    },
    {
      id: 'jd-p1',
      date: '1935-05-03',
      title: '巧渡金沙江：七只木船，甩开追兵',
      narrative:
        '红军一部佯逼昆明，迫使龙云急调各地民团回援省城，江防更加空虚。军委干部团先遣抢占禄劝皎平渡，缴获木船 7 只。\n\n5 月 3 日至 9 日，中央红军主力在 36 名船工协助下，历经七天七夜全部渡过金沙江。两天后国民党军敢死队才追到南岸，只能望江兴叹。',
      graphics: [
        {
          id: 'jd-p1-r-kunming',
          kind: 'arrow',
          side: 'red',
          path: [
            [103.26, 25.56],
            [102.82, 25.22],
          ],
          style: { width: 3800, headWidth: 10000, headLength: 9000, tailTaper: 0.5 },
          label: '佯逼昆明',
        },
        {
          id: 'jd-p1-r-cross',
          kind: 'arrow',
          side: 'red',
          path: [
            [103.26, 25.56],
            [102.47, 25.55],
            [102.31, 26.47],
            [102.25, 26.66],
          ],
          style: { width: 5600, headWidth: 15000, headLength: 14000, tailTaper: 0.48 },
          label: '皎平渡 7 只木船渡过金沙江（5.3—5.9）',
        },
        {
          id: 'jd-p1-e-chase',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [104.50, 25.80],
            [103.30, 26.05],
            [102.52, 26.22],
          ],
          style: { width: 7800, headWidth: 20000, headLength: 18000, tailTaper: 0.72 },
          label: '中央军追至南岸扑空',
        },
      ],
    },
    {
      id: 'jd-p2',
      date: '1935-05-25',
      title: '彝海结盟与强渡大渡河',
      narrative:
        '渡江北上后，蒋介石飞赴昆明、重庆督战，令川军刘湘、刘文辉部严密封锁大渡河，扬言要让红军重蹈太平天国石达开全军覆没的覆辙。\n\n刘伯承在冕宁彝海与彝族首领小叶丹歃血结盟，顺利借道彝区。5 月 25 日晨，红一团十七勇士在安顺场冒死强渡大渡河成功，但水急船少，全军无法迅速渡完。',
      graphics: [
        {
          id: 'jd-p2-r-march',
          kind: 'arrow',
          side: 'red',
          path: [
            [102.25, 26.66],
            [102.26, 27.89],
            [102.15, 28.32],
            [102.30, 29.20],
          ],
          style: { width: 5400, headWidth: 14500, headLength: 13000, tailTaper: 0.5 },
          label: '经西昌、彝海直插安顺场（十七勇士强渡）',
        },
        {
          id: 'jd-p2-e-dadu',
          kind: 'defense',
          side: 'enemy',
          path: [
            [101.85, 29.32],
            [102.75, 29.32],
          ],
          toothSize: 5500,
          toothSide: -1,
          label: '川康军刘文辉部大渡河防线',
        },
        {
          id: 'jd-p2-e-south',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [102.45, 27.20],
            [102.35, 28.25],
          ],
          style: { width: 6500, headWidth: 17000, headLength: 15000, tailTaper: 0.7 },
          label: '国民党追军南北夹逼',
        },
      ],
    },
    {
      id: 'jd-p3',
      date: '1935-05-29',
      title: '飞夺泸定桥：240 里急行军破天险',
      narrative:
        '中革军委果断决定夹河而上，抢夺上游泸定桥。红四团在泥泞山道与暴雨中一昼夜强行军 240 里，与对岸增援川军隔河赛跑，于 29 日晨抢先赶到桥西。\n\n22 名勇士攀踏 13 根光溜铁索冲过火海夺占东岸桥头。6 月 2 日全军渡过大渡河，将大渡河天险与十余万追堵之敌彻底抛在身后。',
      graphics: [
        {
          id: 'jd-p3-r-westbank',
          kind: 'arrow',
          side: 'red',
          path: [
            [102.22, 29.20],
            [102.15, 29.55],
            [102.21, 29.91],
          ],
          style: { width: 5000, headWidth: 13500, headLength: 12000, tailTaper: 0.5 },
          label: '红四团西岸昼夜奔袭 240 里夺桥',
        },
        {
          id: 'jd-p3-r-eastbank',
          kind: 'arrow',
          side: 'red',
          path: [
            [102.36, 29.22],
            [102.35, 29.58],
            [102.26, 29.91],
          ],
          style: { width: 3800, headWidth: 10500, headLength: 9500, tailTaper: 0.5 },
          label: '红一师东岸夹河北上策应',
        },
        {
          id: 'jd-p3-e-yaan',
          kind: 'arrow',
          side: 'enemy',
          path: [
            [103.02, 29.98],
            [102.52, 29.93],
          ],
          style: { width: 6000, headWidth: 16000, headLength: 14000, tailTaper: 0.7 },
          label: '川军自雅安西援泸定（迟到一步）',
        },
        {
          id: 'jd-p3-r-north',
          kind: 'arrow',
          side: 'red',
          path: [
            [102.23, 29.91],
            [102.77, 30.07],
            [102.81, 30.37],
          ],
          style: { width: 4500, headWidth: 12000, headLength: 11000, tailTaper: 0.5 },
          label: '全军渡河后向天全、宝兴（夹金山）挺进',
        },
      ],
    },
  ],
};

export const jinshaDaduHydrography: Record<string, [number, number][]> = {
  jinsha: [
    [101.40, 26.25],
    [101.95, 26.15],
    [102.31, 26.47],
    [102.85, 26.62],
    [103.25, 27.15],
    [103.85, 28.05],
  ],
  dadu: [
    [101.95, 30.65],
    [102.18, 30.22],
    [102.23, 29.91],
    [102.22, 29.45],
    [102.30, 29.20],
    [102.85, 29.28],
    [103.55, 29.45],
  ],
};
