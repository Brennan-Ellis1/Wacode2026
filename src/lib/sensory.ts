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
  placeId: string;
  hour: number;
  dims: SensoryDimensions;
  note?: string;
  createdAt: number;
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
