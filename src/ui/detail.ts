/** 节点详情面板渲染 */
import type { StoryNode } from '../data/types';
import { NODE_SCENE_LINKS } from '../data/scenes';
import { KIND_META, escapeHtml } from '../map/nodes';

const CONF_TEXT: Record<string, string> = {
  high: '',
  medium: '待考',
  disputed: '存疑',
};

function formatDate(node: StoryNode): string {
  const fmt = (s: string) => {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
    if (!m) return s;
    return m[3] ? `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日` : `${m[1]} 年 ${Number(m[2])} 月`;
  };
  if (node.dateEnd) return `${fmt(node.date)} — ${fmt(node.dateEnd)}`;
  return fmt(node.date);
}

export function renderNodeDetail(node: StoryNode): string {
  const meta = KIND_META[node.kind];
  const conf = CONF_TEXT[node.confidence];

  const parts: string[] = [];
  parts.push(`
    <div>
      <span class="dt-kind" style="--kind-color:${meta.color}">
        <svg viewBox="0 0 24 24">${meta.icon}</svg>${meta.label}
      </span>
      ${conf ? `<span class="dt-conf dt-conf--${node.confidence}">${conf}</span>` : ''}
    </div>
    <h2 class="dt-title">${escapeHtml(node.name)}</h2>
    <div class="dt-meta">
      <span>${escapeHtml(formatDate(node))}</span>
      <span>${escapeHtml(node.place)}</span>
    </div>
    <p class="dt-brief">${escapeHtml(node.brief)}</p>
  `);

  const sceneLink = NODE_SCENE_LINKS[node.id];
  if (sceneLink) {
    parts.push(`
      <button
        type="button"
        class="dt-sit-jump"
        data-scene-id="${escapeHtml(sceneLink.sceneId)}"
        data-beat-idx="${sceneLink.beatIndex}"
      >
        <span class="dt-sit-jump__dot"></span>
        <span>${escapeHtml(sceneLink.label)}</span>
        <span class="dt-sit-jump__arrow" aria-hidden="true">→</span>
      </button>
    `);
  }

  parts.push(`
    <div class="dt-body">
      ${node.detail
        .split('\n\n')
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
        .join('')}
    </div>
  `);

  if (node.facts?.length) {
    parts.push(`
      <div class="dt-facts">
        ${node.facts
          .map(
            (f) => `<div class="dt-facts__row"><span>${escapeHtml(f.label)}</span><span>${escapeHtml(
              f.value,
            )}</span></div>`,
          )
          .join('')}
      </div>
    `);
  }

  if (node.poem) {
    parts.push(`
      <div class="dt-poem">
        <h4>${escapeHtml(node.poem.title)}</h4>
        <p>${node.poem.lines.map((l) => escapeHtml(l)).join('\n')}</p>
        ${node.poem.note ? `<footer>${escapeHtml(node.poem.note)}</footer>` : ''}
      </div>
    `);
  }

  if (node.dispute) {
    parts.push(`
      <div class="dt-dispute">
        <strong>史料分歧说明</strong>
        ${escapeHtml(node.dispute)}
      </div>
    `);
  }

  if (node.source?.length) {
    parts.push(`
      <div class="dt-sources">
        <h4>出处</h4>
        <ul>
          ${node.source
            .map(
              (s) => `<li>${
                s.url
                  ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(s.title)}</a>`
                  : escapeHtml(s.title)
              }${s.publisher ? `<em>${escapeHtml(s.publisher)}</em>` : ''}</li>`,
            )
            .join('')}
        </ul>
      </div>
    `);
  }

  return parts.join('');
}

/** "关于数据"弹层内容 */
export function renderAbout(): string {
  return `
    <h2>关于这个项目的史料与坐标</h2>
    <p>本项目是一件历史地理可视化作品。为了让每一条信息都可追溯，所有史实都标注了出处，并对不确定的部分做了显式标记。</p>

    <h3>史实口径</h3>
    <ul>
      <li>会议、战役、行军日期以中共中央党史研究室《中国共产党历史》第一卷、军事科学院《长征记》（曲爱国、张从田著，华夏出版社 2016）为主。</li>
      <li>部队番号、指挥关系、兵力数据以人民网·中国共产党新闻网党史资料、新华社纪念长征系列报道为主。</li>
      <li>凡各资料存在 1—3 天出入的日期，节点标记为<b>「待考」</b>；存在实质分歧的，标记为<b>「存疑」</b>并在详情中写明分歧点。</li>
    </ul>

    <h3>坐标说明</h3>
    <ul>
      <li>所有点位坐标为<b>示意坐标</b>：依据现代行政区划与地名，定位到县城、乡镇、渡口或山口，<b>不是测绘成果</b>，误差约 ±5～15 公里。</li>
      <li>路线为途经点之间的连线示意，并非实际行军折线；实际行军路线远比图上曲折，且多有往返。</li>
      <li>断桥、羊肠小道等微观地形不可能在上千公里尺度的地图上还原，请把本图理解为「叙事地图」而非「行军档案」。</li>
    </ul>

    <h3>态势图标绘说明</h3>
    <ul>
      <li>箭头宽度、集结地半径等均为<b>示意量级</b>，用于表达相对关系与运动方向，不代表实测正面宽度或实际控制范围。</li>
      <li>四渡赤水的双方兵力取自《长征记》第八章：中央红军 3.7 万余人，国民党军约 40 万人。</li>
      <li>四个阶段的标绘是对史料叙述的图形化转译，不是当时的原始作战地图。</li>
    </ul>

    <h3>底图数据</h3>
    <ul>
      <li>地形晕渲：Terrarium DEM（SRTM / GMTED，AWS Open Data），本地预烘为一张 3072×2816 的山体阴影图，完全离线渲染。</li>
      <li>省级边界：阿里云 DataV.GeoAtlas 中国省级边界数据（简化后使用）。</li>
      <li>河流：Natural Earth 1:10m 河流中心线。</li>
    </ul>

    <div class="note">
      本项目的立场：把不确定的东西标注成不确定，比把它写成确定更有价值。
      如发现史实或坐标错误，欢迎指出——数据文件是项目内的 TypeScript 源文件，每一条都带出处字段，便于逐条校订。
    </div>
  `;
}
