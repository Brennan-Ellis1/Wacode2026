import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type Place,
  fmtHour,
  loadToLevel,
  levelColorVar,
  LEVEL_LABELS,
} from "@/lib/sensory";

type Props = {
  places: Place[]; // visible (filtered)
  allPlaces: Place[];
  hour: number;
  userLoc: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
  selectedId: string | null;
};

// Free OSM raster tiles via MapLibre — no token required.
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export function RealMap({
  places,
  allPlaces,
  hour,
  userLoc,
  onSelect,
  selectedId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const maplibreRef = useRef<any>(null);

  // Initialize map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibregl;
      const center: [number, number] = userLoc
        ? [userLoc.lng, userLoc.lat]
        : [-73.9962, 40.7301];
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE as any,
        center,
        zoom: 14,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when user location changes
  useEffect(() => {
    if (!mapRef.current || !userLoc) return;
    mapRef.current.flyTo({
      center: [userLoc.lng, userLoc.lat],
      zoom: 14,
      essential: true,
    });
  }, [userLoc]);

  // Render / update place markers
  useEffect(() => {
    const maplibregl = maplibreRef.current;
    const map = mapRef.current;
    if (!maplibregl || !map) return;

    const visibleIds = new Set(places.map((p) => p.id));
    const seenIds = new Set<string>();

    for (const p of allPlaces) {
      seenIds.add(p.id);
      const load = p.hourly[hour] ?? 0;
      const level = loadToLevel(load);
      const isVisible = visibleIds.has(p.id);
      const isSelected = selectedId === p.id;
      const size = Math.round(18 + load / 7);

      let marker = markersRef.current.get(p.id);
      let el: HTMLDivElement;
      if (!marker) {
        el = document.createElement("div");
        el.style.cursor = "pointer";
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        const dot = document.createElement("span");
        dot.className = "qh-dot";
        el.appendChild(dot);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect(p.id);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        markersRef.current.set(p.id, marker);
      } else {
        el = marker.getElement() as HTMLDivElement;
      }

      el.setAttribute(
        "aria-label",
        `${p.name}, ${p.category}, ${LEVEL_LABELS[level]} at ${fmtHour(hour)}`,
      );
      const dot = el.firstElementChild as HTMLSpanElement;
      const color = levelColorVar(level);
      dot.style.display = "block";
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.borderRadius = "9999px";
      dot.style.backgroundColor = color;
      dot.style.boxShadow = `0 0 0 6px color-mix(in oklab, ${color} 22%, transparent)`;
      dot.style.opacity = isVisible ? "1" : "0.3";
      dot.style.outline = isSelected ? `3px solid var(--primary)` : "none";
      dot.style.outlineOffset = "2px";
      dot.style.transition = "all 200ms ease";
    }

    // Remove markers for places no longer in dataset
    for (const [id, marker] of markersRef.current) {
      if (!seenIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [places, allPlaces, hour, selectedId, onSelect]);

  // User location marker
  useEffect(() => {
    const maplibregl = maplibreRef.current;
    const map = mapRef.current;
    if (!maplibregl || !map) return;
    if (!userLoc) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "9999px";
      el.style.backgroundColor = "var(--primary)";
      el.style.border = "2px solid var(--background)";
      el.style.boxShadow = "0 0 0 6px color-mix(in oklab, var(--primary) 25%, transparent)";
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([userLoc.lng, userLoc.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLoc.lng, userLoc.lat]);
    }
  }, [userLoc]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="region"
      aria-label="Sensory load map with real streets"
    />
  );
}
