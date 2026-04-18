/**
 * Environmental noise raster integration (GeoTIFF / XYZ tiles / coarse grid).
 *
 * ## From TIF + TFW + OVR to web tiles (GDAL)
 *
 * Inspect CRS, range, and nodata:
 *   gdalinfo your.tif
 *
 * If CRS is missing but you have a `.tfw` world file, set source SRS explicitly
 * (example: NAD83 for many US municipal datasets — replace with your actual CRS):
 *   gdalwarp -s_srs EPSG:4269 -t_srs EPSG:3857 noise_3857.tif your.tif
 *
 * Build XYZ tiles for MapLibre `raster` sources (PNG, 256px):
 *   gdal2tiles.py -z 10-16 -w none noise_3857.tif ./out-noise
 * Then copy tiles so URLs match `tilesUrl` in `public/noise/noise-meta.json`, e.g.
 *   `public/noise/{z}/{x}/{y}.png`
 *
 * Encoding: store physical values in the red channel, 8-bit:
 *   R = round(255 * (value - minValue) / (maxValue - minValue)), clamped.
 * Fully transparent pixels (A = 0) are treated as nodata for sampling.
 *
 * ## Runtime without tiles
 *
 * A coarse `grid` in `noise-meta.json` (bbox + width × height + values[]) supports
 * POI sampling and an `image` overlay without GDAL output checked in.
 *
 * Regenerate the grid from `public/noise/*.tif` (no GDAL required):
 *   npm run build:noise-grid
 */

import type { Place } from "@/lib/sensory";

export type NoiseGrid = {
  width: number;
  height: number;
  /** Row-major: increasing east, then south (j = row from north). */
  values: number[];
};

export type NoiseMeta = {
  bbox: [number, number, number, number];
  minValue: number;
  maxValue: number;
  unit: string;
  attribution?: string;
  /** Optional XYZ template, e.g. `/noise/{z}/{x}/{y}.png` */
  tilesUrl?: string;
  sampleZoom?: number;
  minNativeZoom?: number;
  maxNativeZoom?: number;
  grid?: NoiseGrid;
};

const META_URL = "/noise/noise-meta.json";

/** `undefined` = not loaded yet; `null` = fetched but missing/invalid; else parsed meta. */
let metaCache: NoiseMeta | null | undefined;

export function clearNoiseMetaCache() {
  metaCache = undefined;
}

export async function loadNoiseMeta(): Promise<NoiseMeta | null> {
  if (metaCache !== undefined) return metaCache;
  try {
    const res = await fetch(META_URL, { cache: "default" });
    if (!res.ok) {
      metaCache = null;
      return null;
    }
    const data = (await res.json()) as NoiseMeta;
    if (
      !Array.isArray(data.bbox) ||
      data.bbox.length !== 4 ||
      typeof data.minValue !== "number" ||
      typeof data.maxValue !== "number"
    ) {
      metaCache = null;
      return null;
    }
    metaCache = data;
    return data;
  } catch {
    return null;
  }
}

export function physicalToSensoryLoad(raw: number, meta: NoiseMeta): number {
  const span = meta.maxValue - meta.minValue;
  if (span <= 0) return 0;
  const t = (raw - meta.minValue) / span;
  return Math.round(Math.min(100, Math.max(0, t * 100)));
}

function inBbox(lat: number, lng: number, meta: NoiseMeta): boolean {
  const [w, s, e, n] = meta.bbox;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

/** Bilinear sample of `grid` at normalized u,v in [0,1]×[0,1] (origin NW). */
function sampleGridBilinear(grid: NoiseGrid, u: number, v: number): number | null {
  const { width, height, values } = grid;
  if (width < 2 || height < 2 || values.length !== width * height) return null;
  const x = u * (width - 1);
  const y = v * (height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const idx = (xx: number, yy: number) => yy * width + xx;
  const v00 = values[idx(x0, y0)]!;
  const v10 = values[idx(x1, y0)]!;
  const v01 = values[idx(x0, y1)]!;
  const v11 = values[idx(x1, y1)]!;
  const top = v00 * (1 - tx) + v10 * tx;
  const bot = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bot * ty;
}

/** Physical noise value at lat/lng using embedded grid only (sync). */
export function samplePhysicalFromGrid(lat: number, lng: number, meta: NoiseMeta): number | null {
  const grid = meta.grid;
  if (!grid) return null;
  if (!inBbox(lat, lng, meta)) return null;
  const [w, s, e, n] = meta.bbox;
  const u = (lng - w) / (e - w);
  const v = (n - lat) / (n - s);
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return sampleGridBilinear(grid, u, v);
}

function lngLatToTileFraction(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const xf = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x: xf, y: yf };
}

function expandTileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y));
}

const tileRgbaCache = new Map<string, Uint8ClampedArray | "miss">();

async function fetchTileRgba(url: string): Promise<Uint8ClampedArray | null> {
  const hit = tileRgbaCache.get(url);
  if (hit === "miss") return null;
  if (hit) return hit;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      tileRgbaCache.set(url, "miss");
      return null;
    }
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d");
    if (!ctx) {
      tileRgbaCache.set(url, "miss");
      return null;
    }
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    tileRgbaCache.set(url, img.data);
    return img.data;
  } catch {
    tileRgbaCache.set(url, "miss");
    return null;
  }
}

/** Physical value from PNG tile (red channel → linear map to [minValue,maxValue]). */
export async function samplePhysicalFromTiles(
  lat: number,
  lng: number,
  meta: NoiseMeta,
): Promise<number | null> {
  const template = meta.tilesUrl;
  if (!template || !inBbox(lat, lng, meta)) return null;
  const z = Math.min(22, Math.max(0, meta.sampleZoom ?? 14));
  const { x: xf, y: yf } = lngLatToTileFraction(lng, lat, z);
  const xt = Math.floor(xf);
  const yt = Math.floor(yf);
  const px = Math.floor((xf - xt) * 256);
  const py = Math.floor((yf - yt) * 256);
  const url = expandTileUrl(template, z, xt, yt);
  const rgba = await fetchTileRgba(url);
  if (!rgba) return null;
  const i = (py * 256 + px) * 4;
  const a = rgba[i + 3] ?? 255;
  if (a < 8) return null;
  const r = rgba[i] ?? 0;
  const t = r / 255;
  return meta.minValue + t * (meta.maxValue - meta.minValue);
}

/** Prefer grid (sync); otherwise tiles (async). */
export async function sampleEnvSensoryLoad(lat: number, lng: number, meta: NoiseMeta): Promise<number | null> {
  const g = samplePhysicalFromGrid(lat, lng, meta);
  if (g != null) return physicalToSensoryLoad(g, meta);
  const p = await samplePhysicalFromTiles(lat, lng, meta);
  if (p == null) return null;
  return physicalToSensoryLoad(p, meta);
}

/**
 * Combine synthetic hourly load with environmental noise when noise-sensitive mode is on.
 * `noiseStrength` is 0–1; at 1, result is max(base, envLoad).
 */
export function effectiveLoad(
  place: Place,
  hour: number,
  opts: { noiseSensitive: boolean; noiseStrength: number; envLoad: number | null },
): number {
  const base = place.hourly[hour] ?? 0;
  if (!opts.noiseSensitive || opts.envLoad == null) return base;
  const env = opts.envLoad;
  const s = Math.min(1, Math.max(0, opts.noiseStrength));
  const blended = base + s * (env - base);
  return Math.max(base, Math.round(blended));
}

export async function sampleEnvLoadsForPlaces(
  places: Place[],
  meta: NoiseMeta | null,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (!meta) {
    for (const p of places) out.set(p.id, null);
    return out;
  }
  await Promise.all(
    places.map(async (p) => {
      const load = await sampleEnvSensoryLoad(p.lat, p.lng, meta);
      out.set(p.id, load);
    }),
  );
  return out;
}

export type NoiseOverlayImage = {
  dataUrl: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
};

function gridValueRange(grid: NoiseGrid): { vmin: number; vmax: number } {
  let vmin = Infinity;
  let vmax = -Infinity;
  for (const v of grid.values) {
    if (!Number.isFinite(v)) continue;
    vmin = Math.min(vmin, v);
    vmax = Math.max(vmax, v);
  }
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) {
    return { vmin: 0, vmax: 1 };
  }
  if (vmax - vmin < 1e-3) {
    vmax = vmin + 1;
  }
  const pad = (vmax - vmin) * 0.04;
  return { vmin: vmin - pad, vmax: vmax + pad };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Heat colors for display only: quiet (blue-teal) → moderate (gold) → loud (red).
 * Alpha rises with level so loud corridors read more strongly.
 */
function noiseHeatRgba(t01: number): { r: number; g: number; b: number; a: number } {
  const x = Math.min(1, Math.max(0, t01));
  const g = 0.92;
  const te = Math.pow(x, g);
  let r: number;
  let gch: number;
  let b: number;
  if (te < 0.45) {
    const k = te / 0.45;
    r = lerp(25, 70, k);
    gch = lerp(72, 200, k);
    b = lerp(120, 55, k);
  } else if (te < 0.78) {
    const k = (te - 0.45) / 0.33;
    r = lerp(70, 245, k);
    gch = lerp(200, 210, k);
    b = lerp(55, 55, k);
  } else {
    const k = (te - 0.78) / 0.22;
    r = lerp(245, 200, k);
    gch = lerp(210, 35, k);
    b = lerp(55, 38, k);
  }
  const a = Math.round(lerp(38, 195, Math.min(1, 0.25 + 0.75 * te)));
  return { r: Math.round(r), g: Math.round(gch), b: Math.round(b), a };
}

/** Rasterize `meta.grid` to a PNG data URL for a MapLibre `image` source. */
export function gridToOverlayImage(meta: NoiseMeta, pixelSize = 512): NoiseOverlayImage | null {
  const grid = meta.grid;
  if (!grid || grid.width < 2 || grid.height < 2) return null;
  const [w, s, e, n] = meta.bbox;
  const coordinates: NoiseOverlayImage["coordinates"] = [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
  const canvas = document.createElement("canvas");
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(pixelSize, pixelSize);
  const { vmin, vmax } = gridValueRange(grid);
  const span = vmax - vmin;
  for (let row = 0; row < pixelSize; row++) {
    for (let col = 0; col < pixelSize; col++) {
      const u = col / (pixelSize - 1);
      const v = row / (pixelSize - 1);
      const phys = sampleGridBilinear(grid, u, v);
      const t = phys == null ? 0 : (phys - vmin) / span;
      const { r, g, b, a } = noiseHeatRgba(t);
      const j = (row * pixelSize + col) * 4;
      img.data[j] = r;
      img.data[j + 1] = g;
      img.data[j + 2] = b;
      img.data[j + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), coordinates };
}
