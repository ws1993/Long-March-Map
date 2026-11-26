import type { Army, SourceRef } from './types';

/**
 * 长征四支主力部队。
 *
 * 数据核对口径统一采用：中共中央党史研究室《中国共产党历史》第一卷、
 * 军事科学院军事历史和百科研究部《长征记》（曲爱国、张从田，华夏出版社 2016）、
 * 人民网·中国共产党新闻网党史资料、新华社 2024 年长征出发 90 周年系列报道。
 * 具体链接见 docs/01-data-sources.md。
 */

const SRC_PEOPLE_START: SourceRef = {
  title: '中央红军长征开始',
  publisher: '人民网·中国共产党新闻网',
  url: 'https://cpc.people.com.cn/GB/33837/2534266.html',
};

const SRC_CHANGZHENGJI: SourceRef = {
  title: '《长征记》',
  publisher: '曲爱国、张从田著，华夏出版社 2016；人民网党史频道转载',
  url: 'http://dangshi.people.com.cn/GB/146570/406330/index.html',
};

const SRC_XINHUA_2024: SourceRef = {
  title: '而今迈步从头越——写在中央红军长征出发 90 周年之际',
  publisher: '新华社 / 中国政府网',
  url: 'https://www.gov.cn/yaowen/liebiao/202410/content_6980609.htm',
};

const SRC_OVERVIEW: SourceRef = {
  title: '长征概况',
  publisher: '中国青年网（国际在线转载）',
  url: 'https://news.cri.cn/2016-07-27/2d0bbc15-6916-67ad-c980-4ab278e233e5.html',
};

export const SOURCES = { SRC_PEOPLE_START, SRC_CHANGZHENGJI, SRC_XINHUA_2024, SRC_OVERVIEW };

export const armies: Army[] = [
  {
    id: 'red1',
    name: '中国工农红军第一方面军（中央红军）',
    short: '红一方面军 · 中央红军',
    color: '#e0443e',
    startDate: '1934-10-10',
    endDate: '1935-10-19',
    startPlace: '江西瑞金、于都',
    endPlace: '陕西吴起镇（今吴起县）',
    strength: '8.6 万余人（含红一、三、五、八、九军团及中央机关）',
    leaders: '毛泽东、周恩来、朱德、张闻天、博古（前期）；遵义会议后以毛泽东为核心',
    distance: '二万五千里',
    provinces: ['江西', '福建', '广东', '湖南', '广西', '贵州', '云南', '四川', '甘肃', '陕西'],
    summary:
      '第五次反“围剿”失败后，中央红军被迫撤离中央苏区，向西突围。历经湘江血战、通道转兵、遵义会议、四渡赤水、巧渡金沙江、强渡大渡河、飞夺泸定桥、翻雪山过草地、突破腊子口，于 1935 年 10 月 19 日抵达陕北吴起镇，历时一年，行程二万五千里。',
    confidence: 'high',
    source: [SRC_PEOPLE_START, SRC_CHANGZHENGJI, SRC_XINHUA_2024],
  },
  {
    id: 'red25',
    name: '中国工农红军第二十五军',
    short: '红二十五军 · 北上抗日第二先遣队',
    color: '#e8a33d',
    startDate: '1934-11-16',
    endDate: '1935-09-15',
    startPlace: '河南罗山何家冲',
    endPlace: '陕西延川永坪镇',
    strength: '约 3000 人（出发时近 2900 人，到达陕北时约 3400 人，沿途有补充）',
    leaders: '程子华（军长）、吴焕先（政治委员）、徐海东（副军长）、戴季英（参谋长）',
    distance: '近万里',
    provinces: ['河南', '湖北', '陕西', '甘肃', '宁夏'],
    summary:
      '1934 年 11 月 16 日高举“中国工农红军北上抗日第二先遣队”旗帜自豫南何家冲出发，转战鄂豫陕边，创建鄂豫陕革命根据地，1935 年 9 月 15 日到达陕北延川永坪镇，与陕甘红军会师并合编为红十五军团。是四支长征队伍中最早到达陕北的一支。',
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_OVERVIEW],
  },
  {
    id: 'red4',
    name: '中国工农红军第四方面军',
    short: '红四方面军',
    color: '#a259c4',
    startDate: '1935-05-01',
    endDate: '1936-10-09',
    startPlace: '四川彰明、中坝、青川、平武（撤离川陕苏区）',
    endPlace: '甘肃会宁',
    strength: '8 万余人（嘉陵江战役后西进时）',
    leaders: '张国焘（中央代表 / 总政委）、徐向前（总指挥）、陈昌浩（政治委员）',
    distance: '一万余里（含南下川康边往返）',
    provinces: ['四川', '西康', '甘肃', '青海'],
    summary:
      '为策应中央红军，1935 年 3 月 28 日发起嘉陵江战役，随后放弃川陕苏区西进，5 月中旬占茂县、理番，6 月在懋功与红一方面军会师。此后张国焘坚持南下，部队在川康边往返苦战，1936 年 7 月在甘孜与红二、六军团会师，共同北上，10 月 9 日在会宁与红一方面军会师。',
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_OVERVIEW],
  },
  {
    id: 'red2',
    name: '中国工农红军第二方面军（红二、红六军团）',
    short: '红二方面军 · 红二、红六军团',
    color: '#3f8fd2',
    startDate: '1935-11-19',
    endDate: '1936-10-22',
    startPlace: '湖南桑植刘家坪',
    endPlace: '甘肃静宁将台堡（今属宁夏西吉）',
    strength: '1.7 万余人（红二、红六军团出发时）',
    leaders: '贺龙（总指挥）、任弼时（政治委员）、关向应、萧克、王震',
    distance: '约两万里（一说一万六千里至一万九千里，各资料口径不一）',
    provinces: ['湖南', '湖北', '贵州', '云南', '西康', '四川', '甘肃', '宁夏'],
    summary:
      '1935 年 11 月 19 日自湖南桑植出发，转战湘鄂川黔滇，1936 年 3 月在乌蒙山区千里回旋，4 月在云南丽江石鼓渡金沙江、翻越玉龙雪山，7 月 2 日抵甘孜与红四方面军会师，随即组成红二方面军共同北上，10 月 22 日在将台堡与红一方面军会师，长征胜利结束。',
    confidence: 'high',
    source: [SRC_CHANGZHENGJI, SRC_XINHUA_2024],
  },
];

export const armyById = (id: string) => armies.find((a) => a.id === id);
