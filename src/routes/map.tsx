import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SensoryProfileChart } from "@/components/SensoryProfileChart";
import { RealMap } from "@/components/RealMap";
import {
  SEED_PLACES,
  type Place,
  type Report,
  type SensoryDimensions,
  fmtHour,
  loadToLevel,
  levelColorVar,
  LEVEL_LABELS,
  bestHours,
  avgLoad,
  fetchRealWorldPlacesAround,
} from "@/lib/sensory";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Clock, Locate, X, Send, Ear, Eye, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live map — QuietHours" },
      {
        name: "description",
        content:
          "Live sensory-load map. Drag the time slider, filter by what matters to you, and find calm places near you right now.",
      },
      { property: "og:title", content: "Live map — QuietHours" },
      {
        property: "og:description",
        content: "A map color-coded by how loud, bright, and crowded each place is — by hour.",
      },
    ],
  }),
  component: MapPage,
});

const FILTERS = [
  { key: "calm", label: "Calm only" },
  { key: "moderate", label: "Up to moderate" },
  { key: "all", label: "Show all" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const CATEGORIES = ["All", "Café", "Restaurant", "Park", "Library", "Bookstore", "Grocery", "Transit", "Shopping", "Salon", "Community"];

function MapPage() {
  // Initialize to a stable value so SSR and first client render match.
  // The real local hour is applied after hydration.
  const [hour, setHour] = useState(12);
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [category, setCategory] = useState<string>("All");
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [locating, setLocating] = useState(false);
  const [realPlaces, setRealPlaces] = useState<Place[] | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);

  // Load real named places near the active center. Fall back to seed data
  // if OSM is rate-limited or unavailable.
  useEffect(() => {
    const center = userLoc ?? { lat: 40.7301, lng: -73.9962 };
    const ctrl = new AbortController();
    setPlacesLoading(true);
    fetchRealWorldPlacesAround(center, 40, ctrl.signal)
      .then((places) => {
        setRealPlaces(places);
      })
      .catch(() => {
        setRealPlaces(null);
        setAnnouncement("Real-world places unavailable. Showing built-in sample locations.");
      })
      .finally(() => setPlacesLoading(false));

    return () => ctrl.abort();
  }, [userLoc]);

  const allPlaces = useMemo<Place[]>(() => {
    return realPlaces && realPlaces.length > 0 ? realPlaces : SEED_PLACES;
  }, [realPlaces]);

  const visible = useMemo(() => {
    return allPlaces.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      const load = p.hourly[hour];
      const level = loadToLevel(load);
      if (filter === "calm" && level !== "calm") return false;
      if (filter === "moderate" && (level === "busy" || level === "overwhelming")) return false;
      return true;
    });
  }, [allPlaces, hour, filter, category]);

  const selected = allPlaces.find((p) => p.id === selectedId) ?? null;

  function handleLocate() {
    if (!("geolocation" in navigator)) {
      setAnnouncement("Geolocation isn't supported in this browser.");
      return;
    }
    setLocating(true);
    setAnnouncement("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAnnouncement("Location found. Map recentered on you.");
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow access in your browser settings to use this."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Location unavailable right now. Try again, or use the demo location."
              : "Couldn't read your location. Try again or use the demo location.";
        setAnnouncement(msg);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  }

  function submitReport(placeId: string, dims: SensoryDimensions, note?: string) {
    const r: Report = {
      id: `r${Date.now()}`,
      placeId,
      hour,
      dims,
      note,
      createdAt: Date.now(),
    };
    setReports((prev) => [r, ...prev]);
    setReportOpen(false);
    setAnnouncement(`Thanks — your report at ${fmtHour(hour)} was added.`);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader />
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Sidebar */}
        <aside className="flex w-full flex-col gap-4 border-b border-border bg-card/60 p-4 lg:w-80 lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <div>
            <h1 className="text-lg font-semibold">Live sensory map</h1>
            <p className="text-xs text-muted-foreground">
              Showing {visible.length} place{visible.length === 1 ? "" : "s"} at {fmtHour(hour)}
            </p>
            {placesLoading && <p className="mt-1 text-xs text-muted-foreground">Loading nearby real places…</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleLocate} variant="outline" size="sm" disabled={locating}>
              <Locate /> {locating ? "Locating…" : userLoc ? "Update my location" : "Find me"}
            </Button>
          </div>
          {userLoc && (
            <p className="text-xs text-muted-foreground">
              You: {userLoc.lat.toFixed(4)}, {userLoc.lng.toFixed(4)}
            </p>
          )}

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tolerance
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    filter === f.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                  aria-pressed={filter === f.key}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Category
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                  aria-pressed={category === c}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Legend
            </div>
            <ul className="grid grid-cols-2 gap-2 text-xs">
              {(["calm", "moderate", "busy", "overwhelming"] as const).map((lvl) => (
                <li key={lvl} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: levelColorVar(lvl) }}
                    aria-hidden
                  />
                  {LEVEL_LABELS[lvl]}
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden lg:block">
            <PlaceList places={visible} hour={hour} onSelect={setSelectedId} />
          </div>
        </aside>

        {/* Map area */}
        <main className="relative flex-1 overflow-hidden">
          <RealMap
            places={visible}
            allPlaces={allPlaces}
            hour={hour}
            userLoc={userLoc}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />

          {/* Time scrubber */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-5">
            <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl border border-border/70 bg-background/85 p-4 shadow-xl backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Time of day
                </span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 tabular-nums">
                  {fmtHour(hour)}
                </span>
              </div>
              <Slider
                value={[hour]}
                min={0}
                max={23}
                step={1}
                onValueChange={(v) => setHour(v[0] ?? 0)}
                aria-label="Hour of day"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
                <span>11pm</span>
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  onClick={() => setHour(new Date().getHours())}
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  Jump to now ({fmtHour(new Date().getHours())})
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Place detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <PlaceDetail
              place={selected}
              hour={hour}
              reports={reports.filter((r) => r.placeId === selected.id)}
              onReport={() => setReportOpen(true)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Quick report dialog */}
      <Sheet open={reportOpen} onOpenChange={setReportOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          {selected && (
            <QuickReport
              place={selected}
              hour={hour}
              onClose={() => setReportOpen(false)}
              onSubmit={(dims, note) => submitReport(selected.id, dims, note)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PlaceList({
  places,
  hour,
  onSelect,
}: {
  places: Place[];
  hour: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Places
      </div>
      <ul className="space-y-1.5">
        {places.map((p) => {
          const load = p.hourly[hour];
          const level = loadToLevel(load);
          return (
            <li key={p.id}>
              <button
                onClick={() => onSelect(p.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:bg-muted"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: levelColorVar(level) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.category} · {LEVEL_LABELS[level]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {places.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No places match. Try widening your tolerance or category.
          </li>
        )}
      </ul>
    </div>
  );
}

// FauxMap removed — replaced by RealMap (MapLibre + OSM tiles).

function PlaceDetail({
  place,
  hour,
  reports,
  onReport,
}: {
  place: Place;
  hour: number;
  reports: Report[];
  onReport: () => void;
}) {
  const load = place.hourly[hour];
  const level = loadToLevel(load);
  const { quietest, loudest } = bestHours(place);

  return (
    <div className="flex flex-col gap-5">
      <SheetHeader>
        <SheetTitle>{place.name}</SheetTitle>
        <SheetDescription>
          {place.category} · {place.address}
        </SheetDescription>
      </SheetHeader>

      <div
        className="flex items-center gap-3 rounded-xl border border-border p-3"
        style={{
          backgroundColor: `color-mix(in oklab, ${levelColorVar(level)} 18%, var(--card))`,
        }}
      >
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: levelColorVar(level) }}
          aria-hidden
        />
        <div className="flex-1">
          <div className="text-sm font-semibold">{LEVEL_LABELS[level]} right now</div>
          <div className="text-xs text-muted-foreground">
            At {fmtHour(hour)} · load {load}/100
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">24-hour profile</h3>
          <span className="text-xs text-muted-foreground">
            Quietest {fmtHour(quietest)} · Loudest {fmtHour(loudest)}
          </span>
        </div>
        <SensoryProfileChart hourly={place.hourly} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Sensory profile (peak)</h3>
        <DimsBars dims={place.peakDims} />
      </div>

      {place.features.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Notes from the community</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {place.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reports.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Recent live reports</h3>
          <ul className="space-y-2 text-sm">
            {reports.slice(0, 4).map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-background p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    Reported at {fmtHour(r.hour)} · avg {avgLoad(r.dims)}/100
                  </span>
                  <span className="text-[10px] text-muted-foreground">just now</span>
                </div>
                {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={onReport} className="w-full">
        <Send /> Report how it feels right now
      </Button>
    </div>
  );
}

function DimsBars({ dims }: { dims: SensoryDimensions }) {
  const items: Array<{ key: keyof SensoryDimensions; label: string; Icon: typeof Ear }> = [
    { key: "noise", label: "Noise", Icon: Ear },
    { key: "light", label: "Light", Icon: Eye },
    { key: "crowd", label: "Crowd", Icon: Users },
    { key: "smell", label: "Smell", Icon: Sparkles },
  ];
  return (
    <ul className="space-y-2">
      {items.map(({ key, label, Icon }) => {
        const v = dims[key];
        const level = loadToLevel(v);
        return (
          <li key={key} className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="w-14 text-xs font-medium">{label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${v}%`, backgroundColor: levelColorVar(level) }}
              />
            </div>
            <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{v}</span>
          </li>
        );
      })}
    </ul>
  );
}

function QuickReport({
  place,
  hour,
  onClose,
  onSubmit,
}: {
  place: Place;
  hour: number;
  onClose: () => void;
  onSubmit: (dims: SensoryDimensions, note?: string) => void;
}) {
  const [dims, setDims] = useState<SensoryDimensions>({
    noise: 50,
    light: 50,
    crowd: 50,
    smell: 30,
  });
  const [note, setNote] = useState("");

  const items: Array<{ key: keyof SensoryDimensions; label: string; Icon: typeof Ear }> = [
    { key: "noise", label: "Noise", Icon: Ear },
    { key: "light", label: "Light", Icon: Eye },
    { key: "crowd", label: "Crowd", Icon: Users },
    { key: "smell", label: "Smell", Icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">How does {place.name} feel?</h2>
          <p className="text-xs text-muted-foreground">
            Reporting for {fmtHour(hour)} · helps the next person find calm
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5">
        {items.map(({ key, label, Icon }) => {
          const v = dims[key];
          const level = loadToLevel(v);
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${levelColorVar(level)} 30%, transparent)`,
                    color: "var(--foreground)",
                  }}
                >
                  {LEVEL_LABELS[level]}
                </span>
              </div>
              <Slider
                value={[v]}
                min={0}
                max={100}
                step={5}
                onValueChange={(arr) => setDims((d) => ({ ...d, [key]: arr[0] ?? 0 }))}
                aria-label={label}
              />
            </div>
          );
        })}

        <div>
          <label htmlFor="note" className="mb-1 block text-sm font-medium">
            Anything else? <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. School just let out, very loud right now."
            className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <Button onClick={() => onSubmit(dims, note || undefined)} className="w-full">
          <Send /> Submit report
        </Button>
      </div>
    </div>
  );
}

