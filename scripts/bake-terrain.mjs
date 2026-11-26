/**
 * 烘焙离线地形底图。
 *
 * 数据源：AWS Open Data 的 Terrarium DEM 瓦片（基于 SRTM / GMTED，全球 30–90m 分辨率）
 *   https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
 *   高程解码：elevation = (R * 256 + G + B / 256) - 32768
 *
 * 输出：public/geo/terrain-{z}-{x0}-{y0}-{x1}-{y1}.png
 *   一张按 Web Mercator 瓦片网格拼接的地形晕渲图，配合 maplibre 的 image source
 *   用四角经纬度定位，彻底离线可用（无需任何瓦片服务）。
 *
 * 用法：
 *   node --use-env-proxy scripts/bake-terrain.mjs            # 走本机代理下载
 *   node scripts/bake-terrain.mjs --offline                  # 有缓存时离线重算
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * 支持按区域烘焙更高精度的战场底图：
 *   node scripts/bake-terrain.mjs --zoom=10 --bbox=110.2,25.2,111.8,26.2 --name=xiangjiang
 * 不带参数时保持原来的「整幅长征走廊 z=7」行为。
 */
const cliArg = (key, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${key}=`));
  return hit ? hit.slice(key.length + 3) : fallback;
};

const Z = Number(cliArg('zoom', '7'));
const [bMinLon, bMinLat, bMaxLon, bMaxLat] = cliArg('bbox', '93,21,124,44').split(',').map(Number);
const REGION = cliArg('name', '');
/** 区域图边缘羽化比例（0 表示不羽化，整幅图保持不透明） */
const FEATHER = REGION ? 0.07 : 0;
const LON = { min: bMinLon, max: bMaxLon };
const LAT = { min: bMinLat, max: bMaxLat };
const CACHE = path.join(import.meta.dirname, '_raw', 'terrarium');
const OUT = path.join(import.meta.dirname, '..', 'public', 'geo');
const OFFLINE = process.argv.includes('--offline');

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const y2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const X0 = Math.floor(lon2x(LON.min, Z));
const X1 = Math.ceil(lon2x(LON.max, Z)) - 1;
const Y0 = Math.floor(lat2y(LAT.max, Z)); // 纬度大 → y 小
const Y1 = Math.ceil(lat2y(LAT.min, Z)) - 1;

const COLS = X1 - X0 + 1;
const ROWS = Y1 - Y0 + 1;
const W = COLS * 256;
const H = ROWS * 256;

console.log(`[terrain] z=${Z} 瓦片 ${COLS}x${ROWS} = ${COLS * ROWS} 张，画布 ${W}x${H}`);

async function downloadTile(x, y) {
  const file = path.join(CACHE, String(Z), String(x), `${y}.png`);
  if (fs.existsSync(file) && fs.statSync(file).size > 100) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      return file;
    } catch (e) {
      if (attempt === 4) throw new Error(`${url} 下载失败: ${e.message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

async function fetchAll() {
  if (OFFLINE) return;
  const tasks = [];
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) tasks.push([x, y]);
  let done = 0;
  const limit = 8;
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const [x, y] = tasks[idx++];
      await downloadTile(x, y);
      done++;
      if (done % 20 === 0) process.stdout.write(`  已下载 ${done}/${tasks.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  console.log(`  下载完成 ${done} 张`);
}

/** 读取整幅 DEM 到 Float32Array（行优先，单位米） */
async function buildDem() {
  const dem = new Float32Array(W * H);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const x = X0 + tx;
      const y = Y0 + ty;
      const file = path.join(CACHE, String(Z), String(x), `${y}.png`);
      const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== 256 || info.height !== 256) throw new Error(`瓦片尺寸异常 ${file}`);
      for (let py = 0; py < 256; py++) {
        const drow = (ty * 256 + py) * W + tx * 256;
        const srow = py * 256 * 3;
        for (let px = 0; px < 256; px++) {
          const s = srow + px * 3;
          dem[drow + px] = data[s] * 256 + data[s + 1] + data[s + 2] / 256 - 32768;
        }
      }
    }
  }
  return dem;
}

/** 高程色带：深色沙盘风格，低地墨蓝，中地暗绿褐，高地灰白 */
function hypsometric(elev) {
  const stops = [
    [-50, [20, 29, 37]],
    [200, [33, 52, 55]],
    [600, [48, 71, 66]],
    [1200, [70, 89, 80]],
    [2000, [102, 108, 95]],
    [3000, [138, 136, 121]],
    [4000, [180, 174, 158]],
    [5000, [216, 211, 199]],
    [6200, [244, 242, 236]],
  ];
  if (elev <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (elev <= stops[i][0]) {
      const [e0, c0] = stops[i - 1];
      const [e1, c1] = stops[i];
      const t = (elev - e0) / (e1 - e0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

/** Horn 山体阴影 */
function hillshadeAt(dem, px, py) {
  const at = (x, y) => dem[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  const a = at(px - 1, py - 1), b = at(px, py - 1), c = at(px + 1, py - 1);
  const d = at(px - 1, py), f = at(px + 1, py);
  const g = at(px - 1, py + 1), h = at(px, py + 1), i = at(px + 1, py + 1);
  const cell = 1200; // z7 赤道分辨率约 1222m，中纬度取近似值
  const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * cell);
  const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * cell);
  const slope = Math.atan(Math.hypot(dzdx, dzdy));
  const aspect = Math.atan2(dzdy, -dzdx);
  const zenith = ((90 - 42) * Math.PI) / 180; // 光源高度角 42°
  const azimuth = (315 * Math.PI) / 180; // 西北方向光
  let shade =
    Math.cos(zenith) * Math.cos(slope) +
    Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuth - aspect);
  shade = Math.max(0, shade);
  return shade;
}

async function render(dem) {
  const rgb = Buffer.alloc(W * H * 4);
  let minE = Infinity, maxE = -Infinity;
  for (let i = 0; i < dem.length; i++) {
    if (dem[i] < minE) minE = dem[i];
    if (dem[i] > maxE) maxE = dem[i];
  }
  console.log(`  高程范围 ${minE.toFixed(0)}m ~ ${maxE.toFixed(0)}m`);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const e = dem[idx];
      const [r, g, b] = hypsometric(e);
      const sh = hillshadeAt(dem, x, y);
      // 光照系数：阴影处压暗但保留底色，受光处提亮
      const k = 0.35 + 0.95 * sh;
      const o = idx * 4;
      rgb[o] = Math.min(255, r * k);
      rgb[o + 1] = Math.min(255, g * k);
      rgb[o + 2] = Math.min(255, b * k);
      // 区域图做边缘羽化，叠加到总览底图上时不会出现硬接缝
      let a = 255;
      if (FEATHER > 0) {
        const fx = Math.min(x, W - 1 - x) / (W * FEATHER);
        const fy = Math.min(y, H - 1 - y) / (H * FEATHER);
        a = Math.round(255 * Math.max(0, Math.min(1, Math.min(fx, fy))));
      }
      rgb[o + 3] = a;
    }
  }
  return rgb;
}

await fetchAll();
const dem = await buildDem();
console.log('[terrain] DEM 拼接完成，计算晕渲…');
const rgb = await render(dem);

const suffix = REGION ? `-${REGION}` : '';
// 区域战场图用 WebP：地形晕渲是平滑渐变，WebP 能在视觉无损的前提下降一个数量级
const ext = REGION ? 'webp' : 'png';
const name = `terrain-${Z}-${X0}-${Y0}-${X1}-${Y1}${suffix}.${ext}`;
fs.mkdirSync(OUT, { recursive: true });
await sharp(rgb, { raw: { width: W, height: H, channels: 4 } })
  [ext === 'webp' ? 'webp' : 'png'](ext === 'webp' ? { quality: 84, alphaQuality: 90 } : { compressionLevel: 9, palette: false })
  .toFile(path.join(OUT, name));

const bounds = {
  west: x2lon(X0, Z),
  north: y2lat(Y0, Z),
  east: x2lon(X1 + 1, Z),
  south: y2lat(Y1 + 1, Z),
};
fs.writeFileSync(
  path.join(OUT, `terrain-bounds${suffix}.json`),
  JSON.stringify({ file: name, ...bounds, width: W, height: H, source: 'Terrarium DEM (SRTM/GMTED), AWS Open Data' }, null, 2)
);

console.log(`[terrain] 输出 ${name} ${(fs.statSync(path.join(OUT, name)).size / 1024 / 1024).toFixed(1)} MB`);
console.log(`[terrain] 范围 ${bounds.west.toFixed(3)},${bounds.south.toFixed(3)} → ${bounds.east.toFixed(3)},${bounds.north.toFixed(3)}`);
