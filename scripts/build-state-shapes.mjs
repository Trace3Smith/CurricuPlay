// Builds src/data/state-shapes.json for State Lingo Bingo from the us-atlas
// redistribution of the Census Bureau's 2017 cartographic state boundaries.
// The output is checked in so the app never fetches map data at runtime.
// Run: node scripts/build-state-shapes.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const atlasPath = require.resolve('us-atlas/states-albers-10m.json');
const atlasVersion = require('us-atlas/package.json').version;
const topology = JSON.parse(readFileSync(atlasPath, 'utf8'));
// Only the 50 states; DC and territories are not part of the game.
const fips = JSON.parse(readFileSync(new URL('../src/data/state-capitals.json', import.meta.url), 'utf8')).states.map(s => s.fips);

const round = n => Math.round(n * 10) / 10;
function ringPath(ring) {
  let d = '', last = '';
  for (const [x, y] of ring) {
    const point = `${round(x)} ${round(y)}`;
    if (point === last) continue;
    d += `${d ? 'L' : 'M'}${point}`; last = point;
  }
  return `${d}Z`;
}
const states = {};
for (const f of feature(topology, topology.objects.states).features) {
  if (!fips.includes(f.id)) continue;
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const points = polygons.flat(2);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(round);
  states[f.id] = { name: f.properties.name, d: polygons.flat().map(ringPath).join(''), bbox: [x0, y0, round(x1 - x0), round(y1 - y0)] };
}
const missing = fips.filter(id => !states[id]);
if (missing.length) throw new Error(`Missing shapes for FIPS ${missing.join(', ')}`);

writeFileSync(new URL('../src/data/state-shapes.json', import.meta.url), `${JSON.stringify({
  source: {
    name: `us-atlas ${atlasVersion} states-albers-10m.json`,
    derivedFrom: 'U.S. Census Bureau cartographic boundary files, 2017 edition (public domain)',
    url: 'https://www2.census.gov/geo/tiger/GENZ2017/shp/',
    projection: 'd3.geoAlbersUsa, 975×610 viewport (Alaska and Hawaii inset)',
  },
  viewBox: [0, 0, 975, 610],
  states,
})}\n`);
console.log(`Wrote ${Object.keys(states).length} state shapes.`);
