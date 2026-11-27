# 红军长征地图

一个用地图讲述长征的交互式可视化项目：**四支主力部队的行军路线、50 个关键节点、四渡赤水敌我态势**。

底图是完全离线的中国地形沙盘（预烘山体阴影），态势图用自研的标绘几何库在 maplibre 上绘制箭头、集结地与防御阵地。

## 快速开始

```bash
npm install
npm run dev          # http://127.0.0.1:5173
npm run build        # 输出到 dist/，可直接部署到任意静态托管
npm run typecheck    # 类型检查
```

> `public/geo/` 里已包含烘焙好的地形底图与简化后的矢量数据，**开箱即用，不需要联网、不需要任何地图 API key**。

## 项目结构

```
src/
  data/                    史料数据（全部为带出处的 TypeScript 源文件）
    types.ts               数据模型：Army / RouteSegment / StoryNode / Situation
    armies.ts              四支队伍的元信息
    routes.ts              30 段行军路线（含途经点与日期）
    landmarks.ts           28 处战略参照重镇（贵阳、昆明、泸州、松潘等）与战役渡口要隘
    scenes.ts              六大核心战役动态场景剧本与节点跳转映射
    enemy-overview.ts      总览主图随时间轴联动的 8 组国民党军围追堵截态势
    nodes-central.ts       红一方面军 33 个节点
    nodes-others.ts        其他三支队伍 + 三大主力会师 + 诗词 17 个节点
    situations/
      index.ts             水系与战役史料登记表
      xiangjiang.ts        湘江战役史料与水系
      sidu-chishui.ts      四渡赤水史料与水系
      jinsha-dadu.ts       巧渡金沙江·飞夺泸定桥史料与水系
  plot/                    标绘几何库（纯函数，支持 progress 0→1 渐进生长动画）
    geo.ts                 投影、重采样、切线法向、平滑、贝塞尔
    plot.ts                进攻箭头、钳击箭头、集结地、防御阵地、阻击点动态生成
  map/                     地图图层装配
    basemap.ts             底图样式（地形 + 省界 + 河流）
    routes.ts              路线连续推进切分（past / lead / future）+ 跳转缓动
    enemyOverview.ts       总览主图敌军态势层（受比例尺与战役剧场协同控制）
    landmarks.ts           战略重镇与战术要隘图层（三级比例尺 + 场景聚光高亮）
    nodes.ts               DOM 节点标注 + 三级比例尺控量与屏幕防重叠排布
    routeLabels.ts         多锚点部队注记 + 行军推进实时挂签 + 省区水系注记
    situation.ts           战役场景动态标绘与激战脉冲生成 → GeoJSON
  ui/                      界面
    timeline.ts            时间轴控制器（支持战役节拍自适应演播速率）
    detail.ts              节点详情 / 战役场景跳转 / 关于数据
    sceneDirector.ts       六大战役场景编排器（镜头自动跟随、人工拖拽让权与剧场 HUD）
  main.ts                  应用装配
  style.css                视觉系统

scripts/
  prepare-geo.mjs          省界 / 河流的两个公开数据源 → 精简 GeoJSON
  bake-terrain.mjs         Terrarium DEM → 山体阴影 PNG（离线地形底图）

docs/
  00-tech-stack.md         技术栈调研：maplibre 自绘 vs OpenLayers + ol-plot
  01-data-sources.md       数据来源、置信度分级、误差说明
  02-design.md             页面布局与交互设计
```

## 三个阅读层次

1. **总览**：打开即看到四支队伍的全貌，路线随底部时间轴推进而逐段点亮；
2. **深读**：点任意节点，右侧抽屉给出该事件的史实叙述、关键数字、诗词全文与出处；
3. **态势**：点「作战态势」进入战役级视图，目前有两场——**湘江战役**与**四渡赤水**，各按 4~5 个阶段看双方兵力与运动，战场会切换到更清晰的地形底图。

操作提示：`空格` 播放/暂停时间轴，`Esc` 关闭面板。

## 数据可信度的处理方式

每个节点与路线分段都带两个字段：

- `confidence`：`high` / `medium` / `disputed`；
- `source`：出处（著者、出版方、可访问链接）。

`medium` 表示通行说法但个别细节各资料有出入（如黎平会议是 12 月 18 日还是 28 日），节点外圈会显示金色虚线环，详情里写明分歧。**不把不确定的东西伪装成确定**，是这个项目的基本要求。

所有点位坐标都是**示意坐标**（依据现代地名定位，误差约 ±5~15 公里），不是测绘成果。详见 [数据来源与可信度](docs/01-data-sources.md)。

## 技术要点

- **底图**：Terrarium DEM（SRTM/GMTED）预烘为两级地形——整幅走廊用 3072×2816 的总览图，每场战役再叠一张 z=10 的战场图（WebP，0.1~0.3 MB，边缘羽化），配合本地省界与河流 GeoJSON，零请求离线渲染；
- **标绘**：`src/plot/` 用 340 行纯 TypeScript 实现箭头/钳击/集结地/防线的几何生成，在 Mercator 平面内计算以保证「宽度 N 公里」量得准；
- **文字**：全部用 DOM Marker 渲染，不依赖 glyph 字体服务，中文离线可显示；
- **包体积**：主包 gzip 36 KB + maplibre 299 KB + 总览地形 9.1 MB + 战场地形 0.4 MB。
- **节点定位**：`.lm-node` 必须保持 `position: absolute`（由 maplibre 用内联 `transform` 接管）。一旦被写成 `relative`/`static`，节点会掉回文档流，缩放时整体漂移（实测 Y 偏 252px）；按类别隐藏的节点用 `visibility` 而非 `display: none`，否则 `offsetWidth` 归零会让 maplibre 重算 transform 时丢掉居中偏移，恢复显示后固定偏 11.5px；
- **生产构建注意**：maplibre 6 的自带 Worker 按 `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 定位，必须和打包 chunk 同目录。`vite.config.ts` 里的 `maplibreWorkerFile()` 插件在 `closeBundle` 阶段把它拷进 `dist/assets/`，删掉该插件会导致构建版地图完全不渲染（dev 环境不暴露此问题）。

选型理由与适用边界见 [技术栈调研](docs/00-tech-stack.md)。

## 数据来源

- 中共中央党史研究室《中国共产党历史》第一卷
- 曲爱国、张从田《长征记》（华夏出版社 2016）
- 人民网·中国共产党新闻网党史资料
- 新华社「纪念中央红军长征出发 90 周年」系列报道（2024）
- 《毛泽东诗词集》（中共中央文献研究室编）

地形：Terrarium DEM · AWS Open Data；省界：阿里云 DataV.GeoAtlas；河流：Natural Earth。

## 声明

本项目是一件历史地理可视化作品，史料梳理未经党史专业机构审校。它适合作为公众理解长征的空间叙事载体，**不宜作为学术引用来源**。如发现史实或坐标错误，欢迎提 issue 或 PR——数据文件按条目组织，每条都带 `source`，便于逐条校订。
