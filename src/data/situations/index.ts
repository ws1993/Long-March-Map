import type { Situation } from '../types';
import { chishuiHydrography, siduChishui } from './sidu-chishui';
import { xiangjiang, xiangjiangHydrography } from './xiangjiang';
import { jinshaDadu, jinshaDaduHydrography } from './jinsha-dadu';

/** 一张态势图 + 它的水系底纹 */
export interface SituationBundle {
  situation: Situation;
  hydro: Record<string, [number, number][]>;
  /** 切换按钮上的短标签 */
  shortLabel: string;
}

/**
 * 态势图登记表。
 * 新增一场战役：写好数据文件、加一条这里，UI 会自动出现切换按钮。
 */
export const situationBundles: SituationBundle[] = [
  { situation: xiangjiang, hydro: xiangjiangHydrography, shortLabel: '湘江战役' },
  { situation: siduChishui, hydro: chishuiHydrography, shortLabel: '四渡赤水' },
  { situation: jinshaDadu, hydro: jinshaDaduHydrography, shortLabel: '金沙江·大渡河' },
];

/** 关键地图节点到局部作战态势图（战役 + 阶段）的直达映射 */
export interface NodeSituationLink {
  bundleId: string;
  phaseIndex: number;
  buttonLabel: string;
}

export const NODE_SITUATION_LINKS: Record<string, NodeSituationLink> = {
  'n-xiangjiang': { bundleId: 'xiangjiang', phaseIndex: 0, buttonLabel: '查看「湘江战役」四阶段敌我态势详图' },
  'n-zunyi': { bundleId: 'sidu-chishui', phaseIndex: 0, buttonLabel: '查看会后「四渡赤水 · 四十万合围」作战态势' },
  'n-tucheng': { bundleId: 'sidu-chishui', phaseIndex: 1, buttonLabel: '查看「四渡赤水 · 一渡赤水」敌我态势详图' },
  'n-zhaxi': { bundleId: 'sidu-chishui', phaseIndex: 1, buttonLabel: '查看「四渡赤水 · 集结扎西」敌我态势详图' },
  'n-loushan': { bundleId: 'sidu-chishui', phaseIndex: 2, buttonLabel: '查看「四渡赤水 · 二渡与娄山关大捷」态势详图' },
  'n-gouba': { bundleId: 'sidu-chishui', phaseIndex: 3, buttonLabel: '查看「四渡赤水 · 三渡诱敌西进」态势详图' },
  'n-lubanchang': { bundleId: 'sidu-chishui', phaseIndex: 3, buttonLabel: '查看「四渡赤水 · 鲁班场与三渡」态势详图' },
  'n-jinsha': { bundleId: 'jinsha-dadu', phaseIndex: 1, buttonLabel: '查看「巧渡金沙江」敌我追堵态势详图' },
  'n-yihai': { bundleId: 'jinsha-dadu', phaseIndex: 2, buttonLabel: '查看「彝海结盟 · 强渡大渡河」态势详图' },
  'n-dadu': { bundleId: 'jinsha-dadu', phaseIndex: 2, buttonLabel: '查看「强渡大渡河（安顺场）」敌我态势详图' },
  'n-luding': { bundleId: 'jinsha-dadu', phaseIndex: 3, buttonLabel: '查看「飞夺泸定桥」两岸奔袭态势详图' },
};

export { siduChishui, xiangjiang, jinshaDadu };
