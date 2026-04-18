/**
 * One-time / on-demand: downsample TX_rail_road_and_aviation_noise_2020.tif
 * into public/noise/noise-meta.json (WGS84 bbox + coarse grid for overlay + POI sampling).
 *
 * Usage: node scripts/build-noise-grid-from-tif.mjs
 *
 * Requires: public/noise/TX_rail_road_and_aviation_noise_2020.tif
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fromArrayBuffer } from "geotiff";
import proj4 from "proj4";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const tifPath = join(root, "public/noise/TX_rail_road_and_aviation_noise_2020.tif");
const outPath = join(root, "public/noise/noise-meta.json");

const ALBERS =
  "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=23 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs";
const ORIGIN_X = -1000380;
const ORIGIN_Y = 1517940;
const PX = 30;
const NODATA_THRESHOLD = -1e20;

/** WGS84: west, south, east, north (Texas + margin from raster corners) */
const OUT_BBOX = [-107.35, 25.3, -93.2, 36.85];
const OUT_W = 288;
const OUT_H = 268;

function isValidDb(v) {
  return Number.isFinite(v) && v > NODATA_THRESHOLD;
}

async function main() {
  const buf = await readFile(tifPath);
  const tif = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const img = await tif.getImage();
  const W = img.getWidth();
  const H = img.getHeight();

  const buckets = Array.from({ length: OUT_W * OUT_H }, () => ({ s: 0, n: 0 }));
  const [west, south, east, north] = OUT_BBOX;
  const dLng = east - west;
  const dLat = north - south;

  const TILE = 2048;
  let tiles = 0;
  const totalTiles = Math.ceil(W / TILE) * Math.ceil(H / TILE);

  for (let r0 = 0; r0 < H; r0 += TILE) {
    for (let c0 = 0; c0 < W; c0 += TILE) {
      const tw = Math.min(TILE, W - c0);
      const th = Math.min(TILE, H - r0);
      const data = await img.readRasters({ window: [c0, r0, c0 + tw, r0 + th], samples: [0] });
      const arr = data[0];
      for (let j = 0; j < th; j++) {
        for (let i = 0; i < tw; i++) {
          const v = arr[j * tw + i];
          if (!isValidDb(v)) continue;
          const col = c0 + i;
          const row = r0 + j;
          const x = ORIGIN_X + (col + 0.5) * PX;
          const y = ORIGIN_Y - (row + 0.5) * PX;
          const [lng, lat] = proj4(ALBERS, "WGS84", [x, y]);
          if (lng < west || lng > east || lat < south || lat > north) continue;
          let oi = Math.floor(((lng - west) / dLng) * OUT_W);
          let oj = Math.floor(((north - lat) / dLat) * OUT_H);
          oi = Math.max(0, Math.min(OUT_W - 1, oi));
          oj = Math.max(0, Math.min(OUT_H - 1, oj));
          const idx = oj * OUT_W + oi;
          buckets[idx].s += v;
          buckets[idx].n += 1;
        }
      }
      tiles += 1;
      console.error(`tile ${tiles}/${totalTiles} (${c0},${r0}) ${tw}x${th}`);
    }
  }

  const FILL = 45;
  const values = buckets.map((b) => (b.n === 0 ? FILL : Math.round((b.s / b.n) * 100) / 100));

  const meta = {
    bbox: OUT_BBOX,
    minValue: 45,
    maxValue: 125,
    unit: "dB LAeq",
    attribution:
      "National Transportation Noise Map (2020), Texas rail/road/aviation — BTS / Volpe (NTAD). National-level trends only; not for site-specific levels.",
    sampleZoom: 10,
    grid: {
      width: OUT_W,
      height: OUT_H,
      values,
    },
  };

  await writeFile(outPath, JSON.stringify(meta, null, 2), "utf8");
  console.error(`Wrote ${outPath} (${OUT_W}x${OUT_H} cells).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
