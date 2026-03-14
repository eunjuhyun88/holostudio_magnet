/**
 * Generate a compact land mask from Natural Earth 110m TopoJSON.
 * Output: a TypeScript file with a Uint8Array (360x180 grid, 1-degree resolution).
 * Each byte = 8 cells (land=1, water=0).
 */
import { readFileSync, writeFileSync } from 'fs';
import * as topojson from 'topojson-client';

const topoData = JSON.parse(readFileSync('/tmp/land-110m.json', 'utf-8'));
const land = topojson.feature(topoData, topoData.objects.land);

// Point-in-polygon (ray casting)
function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; // [lng, lat] in GeoJSON
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lat, lng, polygon) {
  // First ring is outer, rest are holes
  if (!pointInRing(lat, lng, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lat, lng, polygon[i])) return false; // inside hole
  }
  return true;
}

function isLand(lat, lng) {
  for (const feature of land.features) {
    if (feature.geometry.type === 'Polygon') {
      if (pointInPolygon(lat, lng, feature.geometry.coordinates)) return true;
    } else if (feature.geometry.type === 'MultiPolygon') {
      for (const poly of feature.geometry.coordinates) {
        if (pointInPolygon(lat, lng, poly)) return true;
      }
    }
  }
  return false;
}

// Generate 360x180 grid (cols=lng -180..+179, rows=lat +89..-90)
const W = 360;
const H = 180;
const totalBits = W * H; // 64800
const totalBytes = Math.ceil(totalBits / 8); // 8100
const mask = new Uint8Array(totalBytes);

let landCount = 0;
for (let row = 0; row < H; row++) {
  const lat = 89.5 - row; // center of cell
  for (let col = 0; col < W; col++) {
    const lng = -179.5 + col; // center of cell
    if (isLand(lat, lng)) {
      const bitIndex = row * W + col;
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      mask[byteIndex] |= (1 << bitOffset);
      landCount++;
    }
  }
  if (row % 20 === 0) process.stderr.write(`  row ${row}/${H}\n`);
}

process.stderr.write(`  Land cells: ${landCount} / ${totalBits}\n`);

// Encode as base64
const base64 = Buffer.from(mask).toString('base64');
process.stderr.write(`  Base64 length: ${base64.length}\n`);

// Write TypeScript file
const output = `// Auto-generated land mask (360x180, 1-degree resolution)
// Source: Natural Earth 110m land polygons
// Format: base64-encoded bitmap, row-major (lat 89.5 to -89.5, lng -179.5 to 179.5)
export const LAND_MASK_W = 360;
export const LAND_MASK_H = 180;
export const LAND_MASK_B64 = '${base64}';

let _decoded: Uint8Array | null = null;
function getMask(): Uint8Array {
  if (!_decoded) {
    const bin = atob(LAND_MASK_B64);
    _decoded = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) _decoded[i] = bin.charCodeAt(i);
  }
  return _decoded;
}

export function isLandAt(lat: number, lng: number): boolean {
  const row = Math.floor(89.5 - lat + 0.5);
  const col = Math.floor(lng + 180);
  if (row < 0 || row >= LAND_MASK_H || col < 0 || col >= LAND_MASK_W) return false;
  const bitIndex = row * LAND_MASK_W + col;
  const byteIndex = bitIndex >> 3;
  const bitOffset = bitIndex & 7;
  return (getMask()[byteIndex] & (1 << bitOffset)) !== 0;
}
`;

writeFileSync('src-svelte/lib/landMask.ts', output);
process.stderr.write('  Written src-svelte/lib/landMask.ts\n');
