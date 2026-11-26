/**
 * 地理数据预处理：把体积较大的公开底图数据裁剪/简化成项目内可用的轻量 GeoJSON。
 *
 * 输入（放在 scripts/_raw/ 下，不进版本库）：
 *   china_prov.json    阿里云 DataV.GeoAtlas 中国省级边界（含南海诸岛附图要素）
 *   ne_rivers.geojson  Natural Earth 1:10m 河流中心线
 *
 * 输出：
 *   public/geo/china-provinces.json  省级边界（降精度 + Douglas-Peucker 简化）
 *   public/geo/china-rivers.json     长征区域主要河流
 *
 * 用法：node scripts/prepare-geo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.join(import.meta.dirname, '_raw');
const OUT = path.join(import.meta.dirname, '..', 'public', 'geo');

/** 长征可视化关注的地理范围（西边界取到帕米尔以东，东到福建，南北覆盖陕甘到滇黔） */
export const BBOX = { west: 93, south: 21, east: 124, north: 44 };

const DECIMALS = 4; // 约 11m 精度，视觉上足够
const EPSILON = 0.012; // 简化容差（度）

function roundCoord([x, y]) {
  const f = 10 ** DECIMALS;
  return [Math.round(x * f) / f, Math.round(y * f) / f];
}

function inBBox([x, y], b = BBOX) {
  return x >= b.west && x <= b.east && y >= b.south && y <= b.north;
}

/** Douglas-Peucker 保形简化 */
function simplifyLine(points, eps) {
  if (points.length <= 2) return points;
  const sqEps = eps * eps;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let bestD = 0;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let d;
      if (len2 === 0) {
        d = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        d = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
      }
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD > sqEps && best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function simplifyRing(ring, eps) {
  // 闭合环：先去尾，简化后补尾
  const open = ring.slice(0, -1);
  if (open.length < 4) return ring;
  const s = simplifyLine(open, eps);
  if (s.length < 3) return ring;
  s.push(s[0]);
  return s;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

function cleanGeometry(geom, eps) {
  if (geom.type === 'LineString') {
    return { type: 'LineString', coordinates: simplifyLine(geom.coordinates.map(roundCoord), eps) };
  }
  if (geom.type === 'MultiLineString') {
    return {
      type: 'MultiLineString',
      coordinates: geom.coordinates
        .map((c) => simplifyLine(c.map(roundCoord), eps))
        .filter((c) => c.length >= 2),
    };
  }
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map((r) => simplifyRing(r.map(roundCoord), eps)) };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates
        .map((poly) => poly.map((r) => simplifyRing(r.map(roundCoord), eps)))
        // 过滤掉简化后退化的微小岛屿，但保留较大的岛（如海南岛、台湾岛）
        .filter((poly) => poly[0] && ringArea(poly[0]) > 0.0008),
    };
  }
  return geom;
}

function write(file, data) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data));
  const kb = (fs.statSync(path.join(OUT, file)).size / 1024).toFixed(1);
  console.log(`  → ${file}  ${kb} KB`);
}

// ---------------------------------------------------------------- 省级边界
function buildProvinces() {
  const src = JSON.parse(fs.readFileSync(path.join(RAW, 'china_prov.json'), 'utf8'));
  const features = [];
  for (const f of src.features) {
    const name = f.properties.name || '';
    // 南海诸岛附图（adcode 100000_JD）保留为独立要素，但只保留其轮廓
    const geom = cleanGeometry(f.geometry, 0.02);
    features.push({
      type: 'Feature',
      properties: {
        adcode: f.properties.adcode,
        name,
        short: name.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|内蒙古|西藏|广西|宁夏|新疆)/g, '').slice(0, 4),
        centroid: f.properties.centroid || f.properties.center,
        level: f.properties.level,
      },
      geometry: geom,
    });
  }
  console.log('省界要素:', features.length);
  write('china-provinces.json', { type: 'FeatureCollection', features });
}

// ---------------------------------------------------------------- 主要河流
function buildRivers() {
  const src = JSON.parse(fs.readFileSync(path.join(RAW, 'ne_rivers.geojson'), 'utf8'));
  const features = [];
  for (const f of src.features) {
    const p = f.properties || {};
    // 只保留区域内的重要河流：Natural Earth 的 scalerank 越小越重要
    if ((p.scalerank ?? 99) > 8) continue;
    const geom = cleanGeometry(f.geometry, 0.01);
    const coords = geom.type === 'LineString' ? geom.coordinates : geom.coordinates.flat();
    if (!coords.some((c) => inBBox(c))) continue;
    features.push({
      type: 'Feature',
      properties: {
        name: p.name || p.name_en || '',
        name_en: p.name_en || '',
        scalerank: p.scalerank,
      },
      geometry: geom,
    });
  }
  console.log('河流要素:', features.length);
  write('china-rivers.json', { type: 'FeatureCollection', features });
}

console.log('[prepare-geo] 生成底图数据');
buildProvinces();
buildRivers();
console.log('[prepare-geo] 完成');
