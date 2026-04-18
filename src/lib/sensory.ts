// Sensory load model + seed data for QuietHours

export type SensoryLevel = "calm" | "moderate" | "busy" | "overwhelming" | "unknown";

export type SensoryDimensions = {
  noise: number; // 0-100
  light: number;
  crowd: number;
  smell: number;
};

export type Place = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  // 24-hour profile of average load (0-100)
  hourly: number[];
  // dimensional pattern at peak
  peakDims: SensoryDimensions;
  features: string[]; // e.g. "low lighting available", "quiet room"
};

export type Report = {
  id: string;
  userId: string;
  userEmail: string;
  placeId: string;
  hour: number;
  dims: SensoryDimensions;
  note?: string;
  createdAt: number;
};

type OSMElement = {
  type?: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

export const LEVEL_LABELS: Record<SensoryLevel, string> = {
  calm: "Calm",
  moderate: "Moderate",
  busy: "Busy",
  overwhelming: "Overwhelming",
  unknown: "Unknown",
};

export function loadToLevel(load: number | undefined | null): SensoryLevel {
  if (load == null || Number.isNaN(load)) return "unknown";
  if (load < 30) return "calm";
  if (load < 55) return "moderate";
  if (load < 78) return "busy";
  return "overwhelming";
}

export function levelColorVar(level: SensoryLevel): string {
  return `var(--${level})`;
}

export function avgLoad(d: SensoryDimensions): number {
  return Math.round((d.noise + d.light + d.crowd + d.smell) / 4);
}

// Generate a believable 24h profile given a peak hour and intensity
function profile(peakHour: number, peakLoad: number, base: number): number[] {
  return Array.from({ length: 24 }, (_, h) => {
    const dist = Math.min(Math.abs(h - peakHour), 24 - Math.abs(h - peakHour));
    const falloff = Math.exp(-(dist * dist) / 8);
    const v = base + (peakLoad - base) * falloff;
    // night quiet
    if (h < 7 || h > 22) return Math.max(5, v * 0.25);
    return Math.round(v);
  });
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CATEGORY_CONFIG: Record<
  string,
  {
    category: string;
    peakHour: number;
    peakLoad: number;
    base: number;
    peakDims: SensoryDimensions;
    features: string[];
  }
> = {
  cafe: {
    category: "Café",
    peakHour: 9,
    peakLoad: 80,
    base: 25,
    peakDims: { noise: 78, light: 65, crowd: 80, smell: 60 },
    features: ["Cafe rush tends to peak in the morning"],
  },
  restaurant: {
    category: "Restaurant",
    peakHour: 19,
    peakLoad: 78,
    base: 28,
    peakDims: { noise: 78, light: 60, crowd: 75, smell: 70 },
    features: ["Dinner hours are often busiest"],
  },
  library: {
    category: "Library",
    peakHour: 14,
    peakLoad: 35,
    base: 15,
    peakDims: { noise: 30, light: 45, crowd: 35, smell: 15 },
    features: ["Generally quieter than retail spaces"],
  },
  supermarket: {
    category: "Grocery",
    peakHour: 18,
    peakLoad: 85,
    base: 35,
    peakDims: { noise: 78, light: 92, crowd: 82, smell: 65 },
    features: ["Evening shopping periods are often intense"],
  },
  mall: {
    category: "Shopping",
    peakHour: 16,
    peakLoad: 90,
    base: 45,
    peakDims: { noise: 88, light: 95, crowd: 90, smell: 75 },
    features: ["Crowd and lighting can be high in malls"],
  },
  park: {
    category: "Park",
    peakHour: 12,
    peakLoad: 50,
    base: 18,
    peakDims: { noise: 45, light: 70, crowd: 55, smell: 25 },
    features: ["Outdoor spaces can feel calmer off-peak"],
  },
  station: {
    category: "Transit",
    peakHour: 8,
    peakLoad: 92,
    base: 40,
    peakDims: { noise: 92, light: 78, crowd: 90, smell: 65 },
    features: ["Transit hubs spike during commute windows"],
  },
  community: {
    category: "Community",
    peakHour: 17,
    peakLoad: 60,
    base: 22,
    peakDims: { noise: 55, light: 50, crowd: 60, smell: 30 },
    features: ["Community spaces vary by scheduled events"],
  },
};

function inferCategoryFromTags(tags: Record<string, string>): keyof typeof CATEGORY_CONFIG {
  const amenity = tags.amenity ?? "";
  const leisure = tags.leisure ?? "";
  const shop = tags.shop ?? "";
  const railway = tags.railway ?? "";
  const publicTransport = tags.public_transport ?? "";

  if (amenity === "cafe") return "cafe";
  if (amenity === "restaurant" || amenity === "fast_food") return "restaurant";
  if (amenity === "library") return "library";
  if (amenity === "parking" || amenity === "parking_entrance") return "community";
  if (amenity === "community_centre" || amenity === "social_centre") return "community";
  if (amenity === "bus_station" || publicTransport === "station" || railway === "station") return "station";
  if (shop === "supermarket" || shop === "convenience" || shop === "grocery") return "supermarket";
  if (shop === "mall" || shop === "department_store") return "mall";
  if (leisure === "park" || tags.landuse === "park") return "park";
  return "community";
}

function isLikelyParking(
  props: Pick<NonNullable<PhotonFeature["properties"]>, "name" | "osm_key" | "osm_value">
): boolean {
  const name = (props.name ?? "").toLowerCase();
  const osmKey = (props.osm_key ?? "").toLowerCase();
  const osmValue = (props.osm_value ?? "").toLowerCase();
  if (osmKey === "amenity" && (osmValue === "parking" || osmValue === "parking_entrance")) return true;
  return /\bparking\b|\bcar park\b|\bparking lot\b|\bgarage\b/.test(name);
}

function isLikelyParkName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!/\bpark\b/.test(n)) return false;
  // Exclude street names like "123 Park Ave" or "Park Avenue Cafe".
  if (/\bpark\s+(ave|avenue|st|street|rd|road|blvd|boulevard|dr|drive|way|pl|place)\b/.test(n)) {
    return false;
  }
  return true;
}

function buildFeaturesFromTags(tags: Record<string, string>, baseFeatures: string[]): string[] {
  const out = [...baseFeatures];
  if (tags.wheelchair === "yes") out.push("Wheelchair accessible");
  if (tags.toilets === "yes") out.push("Public toilets listed");
  if (tags.opening_hours) out.push(`Hours: ${tags.opening_hours}`);
  return out.slice(0, 4);
}

function elementCoords(el: OSMElement): { lat: number; lng: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function distanceSquared(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function mapOsmElementToPlace(el: OSMElement): Place | null {
  const tags = el.tags ?? {};
  const coords = elementCoords(el);
  if (!coords) return null;

  const categoryKey = inferCategoryFromTags(tags);
  const cfg = CATEGORY_CONFIG[categoryKey];
  const seed = hashString(`${el.id}:${tags.name ?? ""}:${coords.lat.toFixed(6)}:${coords.lng.toFixed(6)}`);
  const rand = mulberry32(seed);
  const peakJitter = Math.round((rand() - 0.5) * 12);
  const baseJitter = Math.round((rand() - 0.5) * 8);

  const displayName = tags.name || tags.brand || `${cfg.category} ${el.id}`;
  const address = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim() || "Nearby";

  return {
    id: `osm-${el.type ?? "node"}-${el.id}`,
    name: displayName,
    category: cfg.category,
    lat: coords.lat,
    lng: coords.lng,
    address,
    hourly: profile(cfg.peakHour, Math.max(20, cfg.peakLoad + peakJitter), Math.max(10, cfg.base + baseJitter)),
    peakDims: cfg.peakDims,
    features: buildFeaturesFromTags(tags, cfg.features),
  };
}

function mapCategoryKeyToLabel(key: keyof typeof CATEGORY_CONFIG): string {
  return CATEGORY_CONFIG[key].category;
}

function mapPhotonFeatureToPlace(
  feature: PhotonFeature,
  center: { lat: number; lng: number },
  fallbackCategoryKey: keyof typeof CATEGORY_CONFIG
): Place | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const lng = coords[0];
  const lat = coords[1];
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const props = feature.properties ?? {};
  if (isLikelyParking(props)) return null;
  const osmId = props.osm_id ?? hashString(`${lat}:${lng}:${props.name ?? ""}`);
  const osmType = (props.osm_type ?? "N").toLowerCase();

  const pseudoTags: Record<string, string> = {};
  if (props.osm_key && props.osm_value) {
    pseudoTags[props.osm_key] = props.osm_value;
  }
  const inferred = inferCategoryFromTags(pseudoTags);
  const fallbackAllowed =
    inferred === "community" &&
    fallbackCategoryKey !== "community" &&
    !isLikelyParking(props) &&
    (fallbackCategoryKey !== "park" || isLikelyParkName(props.name ?? ""));
  const categoryKey = fallbackAllowed ? fallbackCategoryKey : inferred;
  const cfg = CATEGORY_CONFIG[categoryKey];

  const seed = hashString(`${osmType}:${osmId}:${props.name ?? ""}:${lat.toFixed(6)}:${lng.toFixed(6)}`);
  const rand = mulberry32(seed);
  const peakJitter = Math.round((rand() - 0.5) * 12);
  const baseJitter = Math.round((rand() - 0.5) * 8);

  const displayName = props.name?.trim() || `${mapCategoryKeyToLabel(categoryKey)} ${osmId}`;
  const address =
    [props.housenumber, props.street].filter(Boolean).join(" ").trim() ||
    [props.city, props.district, props.county, props.state].filter(Boolean).join(", ").trim() ||
    "Nearby";

  const place: Place = {
    id: `photon-${osmType}-${osmId}`,
    name: displayName,
    category: cfg.category,
    lat,
    lng,
    address,
    hourly: profile(cfg.peakHour, Math.max(20, cfg.peakLoad + peakJitter), Math.max(10, cfg.base + baseJitter)),
    peakDims: cfg.peakDims,
    features: buildFeaturesFromTags({}, cfg.features),
  };

  const maxDistanceSq = 0.2 * 0.2;
  if (distanceSquared({ lat: place.lat, lng: place.lng }, center) > maxDistanceSq) {
    return null;
  }
  return place;
}

async function fetchFromPhoton(
  center: { lat: number; lng: number },
  count: number,
  signal?: AbortSignal
): Promise<Place[]> {
  const searches: Array<{ term: string; category: keyof typeof CATEGORY_CONFIG }> = [
    { term: "cafe", category: "cafe" },
    { term: "restaurant", category: "restaurant" },
    { term: "library", category: "library" },
    { term: "supermarket", category: "supermarket" },
    { term: "park", category: "park" },
    { term: "station", category: "station" },
    { term: "mall", category: "mall" },
    { term: "community center", category: "community" },
  ];

  const responses = await Promise.all(
    searches.map(async ({ term, category }) => {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("lat", String(center.lat));
      url.searchParams.set("lon", String(center.lng));
      url.searchParams.set("limit", "30");
      url.searchParams.set("q", term);
      const res = await fetch(url.toString(), { signal });
      if (!res.ok) return [];
      const data = (await res.json()) as { features?: PhotonFeature[] };
      return (data.features ?? [])
        .map((f) => mapPhotonFeatureToPlace(f, center, category))
        .filter((p): p is Place => p !== null);
    })
  );

  const deduped = new Map<string, Place>();
  for (const group of responses) {
    for (const p of group) {
      const key = `${p.name.toLowerCase()}|${p.category}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, p);
        continue;
      }
      const nextDist = distanceSquared({ lat: p.lat, lng: p.lng }, center);
      const existingDist = distanceSquared({ lat: existing.lat, lng: existing.lng }, center);
      if (nextDist < existingDist) deduped.set(key, p);
    }
  }

  return Array.from(deduped.values())
    .sort(
      (a, b) =>
        distanceSquared({ lat: a.lat, lng: a.lng }, center) -
        distanceSquared({ lat: b.lat, lng: b.lng }, center)
    )
    .slice(0, count);
}

async function fetchFromOverpass(
  endpoint: string,
  center: { lat: number; lng: number },
  count: number,
  signal?: AbortSignal
): Promise<Place[]> {
  const radiusMeters = 3500;
  const maxResults = Math.max(120, count * 15);
  const overpassQuery = `
[out:json][timeout:30];
(
  nwr(around:${radiusMeters},${center.lat},${center.lng})["name"]["amenity"~"cafe|restaurant|fast_food|library|community_centre|social_centre|bus_station|bar|pub|food_court|marketplace|cinema|theatre|arts_centre"];
  nwr(around:${radiusMeters},${center.lat},${center.lng})["name"]["shop"~"supermarket|convenience|grocery|mall|department_store|bakery|books|clothes|chemist|hairdresser"];
  nwr(around:${radiusMeters},${center.lat},${center.lng})["name"]["leisure"~"park|playground|sports_centre|fitness_centre"];
  nwr(around:${radiusMeters},${center.lat},${center.lng})["name"]["tourism"~"museum|attraction|gallery"];
  nwr(around:${radiusMeters},${center.lat},${center.lng})["name"]["railway"~"station|halt"];
  nwr(around:${radiusMeters},${center.lat},${center.lng})["name"]["public_transport"~"station|stop_position|platform"];
);
out center ${maxResults};
`;

  const res = await fetch(endpoint, {
    method: "POST",
    body: overpassQuery,
    signal,
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
  });
  if (!res.ok) {
    throw new Error(`OSM request failed with status ${res.status}`);
  }
  const data = (await res.json()) as { elements?: OSMElement[] };
  const dedupedByNameAndCategory = new Map<string, Place>();
  for (const p of (data.elements ?? []).map(mapOsmElementToPlace).filter((x): x is Place => x !== null)) {
    const key = `${p.name.toLowerCase()}|${p.category}`;
    const existing = dedupedByNameAndCategory.get(key);
    if (!existing) {
      dedupedByNameAndCategory.set(key, p);
      continue;
    }
    const nextDist = distanceSquared({ lat: p.lat, lng: p.lng }, center);
    const existingDist = distanceSquared({ lat: existing.lat, lng: existing.lng }, center);
    if (nextDist < existingDist) {
      dedupedByNameAndCategory.set(key, p);
    }
  }

  const places = Array.from(dedupedByNameAndCategory.values())
    .sort(
      (a, b) =>
        distanceSquared({ lat: a.lat, lng: a.lng }, center) -
        distanceSquared({ lat: b.lat, lng: b.lng }, center)
    )
    .slice(0, count);
  return places;
}

export async function fetchRealWorldPlacesAround(
  center: { lat: number; lng: number },
  count = 10,
  signal?: AbortSignal
): Promise<Place[]> {
  try {
    const photonPlaces = await fetchFromPhoton(center, count, signal);
    if (photonPlaces.length > 0) return photonPlaces;
  } catch {
    // Fall through to Overpass mirrors.
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const places = await fetchFromOverpass(endpoint, center, count, signal);
      if (places.length > 0) return places;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to load real-world places");
}

// ---- Procedural seeding around an arbitrary location ----

type Template = {
  name: string;
  category: string;
  peakHour: number;
  peakLoad: number;
  base: number;
  peakDims: SensoryDimensions;
  features: string[];
};

const TEMPLATES: Template[] = [
  {
    name: "Morning Bean Café",
    category: "Café",
    peakHour: 9,
    peakLoad: 80,
    base: 25,
    peakDims: { noise: 78, light: 65, crowd: 80, smell: 60 },
    features: ["Quiet between 11am–1pm", "Warm pendant lighting"],
  },
  {
    name: "Riverbend Library",
    category: "Library",
    peakHour: 14,
    peakLoad: 35,
    base: 15,
    peakDims: { noise: 30, light: 45, crowd: 35, smell: 15 },
    features: ["Quiet study rooms", "Sensory kits at front desk"],
  },
  {
    name: "Greenway Park",
    category: "Park",
    peakHour: 12,
    peakLoad: 50,
    base: 18,
    peakDims: { noise: 45, light: 70, crowd: 55, smell: 25 },
    features: ["Open space", "Shaded benches"],
  },
  {
    name: "Cornerstone Grocery",
    category: "Grocery",
    peakHour: 18,
    peakLoad: 85,
    base: 35,
    peakDims: { noise: 78, light: 92, crowd: 82, smell: 65 },
    features: ["Quiet hour Tue/Thu 8–9am", "Bright fluorescents"],
  },
  {
    name: "Birch & Page Books",
    category: "Bookstore",
    peakHour: 16,
    peakLoad: 40,
    base: 18,
    peakDims: { noise: 35, light: 50, crowd: 38, smell: 20 },
    features: ["Quiet by policy", "Soft warm lighting"],
  },
  {
    name: "Tide Diner",
    category: "Restaurant",
    peakHour: 19,
    peakLoad: 78,
    base: 28,
    peakDims: { noise: 78, light: 60, crowd: 75, smell: 70 },
    features: ["Booth seating", "Music turned down on request"],
  },
  {
    name: "Central Transit Hub",
    category: "Transit",
    peakHour: 8,
    peakLoad: 92,
    base: 40,
    peakDims: { noise: 92, light: 78, crowd: 90, smell: 65 },
    features: ["Accessible elevator", "Loud announcements"],
  },
  {
    name: "Maple Community Center",
    category: "Community",
    peakHour: 17,
    peakLoad: 60,
    base: 22,
    peakDims: { noise: 55, light: 50, crowd: 60, smell: 30 },
    features: ["Predictable schedule", "Sensory-friendly events listed"],
  },
  {
    name: "Lumen Salon",
    category: "Salon",
    peakHour: 12,
    peakLoad: 65,
    base: 25,
    peakDims: { noise: 60, light: 70, crowd: 55, smell: 85 },
    features: ["Fragrance-light products on request", "Private room available"],
  },
  {
    name: "Quay Plaza Mall",
    category: "Shopping",
    peakHour: 16,
    peakLoad: 90,
    base: 45,
    peakDims: { noise: 88, light: 95, crowd: 90, smell: 75 },
    features: ["Sensory-friendly hours Sun 9–11am", "Quiet room near east entrance"],
  },
];

// Deterministic PRNG so the same location yields the same seed
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate believable sensory places around a center coordinate.
 * Spreads roughly 200m–1.5km in each direction.
 */
export function generatePlacesAround(
  center: { lat: number; lng: number },
  count = 10
): Place[] {
  const seed = Math.floor((center.lat + 90) * 1000) * 1000 + Math.floor((center.lng + 180) * 1000);
  const rand = mulberry32(seed);
  const out: Place[] = [];
  for (let i = 0; i < count; i++) {
    const t = TEMPLATES[i % TEMPLATES.length];
    // ~0.002–0.014 deg ≈ 200m–1.5km offset
    const angle = rand() * Math.PI * 2;
    const dist = 0.002 + rand() * 0.012;
    const lat = center.lat + Math.sin(angle) * dist;
    // longitude offset shrinks with latitude
    const lng = center.lng + (Math.cos(angle) * dist) / Math.max(0.2, Math.cos((center.lat * Math.PI) / 180));
    // jitter the profile a bit for variety
    const peakJitter = Math.round((rand() - 0.5) * 10);
    const baseJitter = Math.round((rand() - 0.5) * 6);
    out.push({
      id: `gen-${i}-${seed}`,
      name: t.name,
      category: t.category,
      lat,
      lng,
      address: "Near you",
      hourly: profile(t.peakHour, Math.max(20, t.peakLoad + peakJitter), Math.max(10, t.base + baseJitter)),
      peakDims: t.peakDims,
      features: t.features,
    });
  }
  return out;
}

export const SEED_PLACES: Place[] = [
  {
    id: "p1",
    name: "Linden Café",
    category: "Café",
    lat: 40.7308,
    lng: -73.9973,
    address: "112 Linden St",
    hourly: profile(13, 88, 25),
    peakDims: { noise: 90, light: 70, crowd: 88, smell: 60 },
    features: ["Quiet corner after 3pm", "Dimmable pendant lights"],
  },
  {
    id: "p2",
    name: "Hush Books",
    category: "Bookstore",
    lat: 40.7298,
    lng: -73.9952,
    address: "44 Mercer Ave",
    hourly: profile(15, 38, 18),
    peakDims: { noise: 35, light: 45, crowd: 40, smell: 25 },
    features: ["Quiet by policy", "Soft warm lighting", "Sensory room upstairs"],
  },
  {
    id: "p3",
    name: "Metro Station — Court St",
    category: "Transit",
    lat: 40.7335,
    lng: -73.9921,
    address: "Court St & 7 Ave",
    hourly: profile(8, 95, 40),
    peakDims: { noise: 95, light: 80, crowd: 92, smell: 70 },
    features: ["Accessible elevator", "Loud announcements"],
  },
  {
    id: "p4",
    name: "Riverside Park",
    category: "Park",
    lat: 40.7281,
    lng: -73.9994,
    address: "West Embankment",
    hourly: profile(11, 55, 22),
    peakDims: { noise: 50, light: 65, crowd: 60, smell: 30 },
    features: ["Open space", "Shaded benches", "Predictable crowd"],
  },
  {
    id: "p5",
    name: "Citymart Grocery",
    category: "Grocery",
    lat: 40.7262,
    lng: -73.9938,
    address: "200 Bedford Ave",
    hourly: profile(18, 82, 35),
    peakDims: { noise: 75, light: 92, crowd: 80, smell: 65 },
    features: ["Quiet hour 8-9am Tue/Thu", "Bright fluorescent lighting"],
  },
  {
    id: "p6",
    name: "Northside Library",
    category: "Library",
    lat: 40.7321,
    lng: -73.9986,
    address: "1 Library Plaza",
    hourly: profile(14, 32, 15),
    peakDims: { noise: 28, light: 40, crowd: 35, smell: 15 },
    features: ["Quiet study rooms", "Sensory kits available", "Low-stim entrance"],
  },
  {
    id: "p7",
    name: "Bowl & Spoon Diner",
    category: "Restaurant",
    lat: 40.7290,
    lng: -73.9905,
    address: "88 Forest St",
    hourly: profile(19, 78, 28),
    peakDims: { noise: 78, light: 60, crowd: 75, smell: 70 },
    features: ["Booth seating", "Music turned down on request"],
  },
  {
    id: "p8",
    name: "Tide Salon",
    category: "Salon",
    lat: 40.7345,
    lng: -73.9955,
    address: "5 Atlantic Way",
    hourly: profile(12, 65, 25),
    peakDims: { noise: 60, light: 70, crowd: 55, smell: 85 },
    features: ["Fragrance-light products on request", "Private room available"],
  },
  {
    id: "p9",
    name: "Quay Plaza Mall",
    category: "Shopping",
    lat: 40.7268,
    lng: -73.9920,
    address: "Quay Plaza",
    hourly: profile(16, 92, 45),
    peakDims: { noise: 88, light: 95, crowd: 90, smell: 75 },
    features: ["Sensory-friendly hours Sun 9-11am", "Quiet room near east entrance"],
  },
  {
    id: "p10",
    name: "Maple Community Center",
    category: "Community",
    lat: 40.7312,
    lng: -73.9999,
    address: "33 Maple Row",
    hourly: profile(17, 60, 22),
    peakDims: { noise: 55, light: 50, crowd: 60, smell: 30 },
    features: ["Predictable schedule", "Sensory-friendly events listed"],
  },
];

export function getCurrentLoad(place: Place, hour: number): number {
  return place.hourly[hour] ?? 0;
}

export function bestHours(place: Place): { quietest: number; loudest: number } {
  let qi = 7,
    li = 7;
  for (let h = 7; h <= 22; h++) {
    if (place.hourly[h] < place.hourly[qi]) qi = h;
    if (place.hourly[h] > place.hourly[li]) li = h;
  }
  return { quietest: qi, loudest: li };
}

export function fmtHour(h: number): string {
  const am = h < 12;
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}${am ? "am" : "pm"}`;
}
