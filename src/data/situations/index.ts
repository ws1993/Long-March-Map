import type { Situation } from '../types';
import { chishuiHydrography, siduChishui } from './sidu-chishui';
import { xiangjiang, xiangjiangHydrography } from './xiangjiang';

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
  { situation: siduChishui, hydro: chishuiHydrography, shortLabel: '四渡赤水' },
  { situation: xiangjiang, hydro: xiangjiangHydrography, shortLabel: '湘江战役' },
];

export { siduChishui, xiangjiang };
