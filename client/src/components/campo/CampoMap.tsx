import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { MapPin, Maximize2, Minimize2, Navigation, Search, ChevronDown, ChevronUp, AlertTriangle, Flame, X, Calendar, Tag, Layers, ShieldAlert, Pencil } from "lucide-react";
import "leaflet/dist/leaflet.css";

// ── Kernel Density Estimation ───────────────────────────────────────────────
// Gaussian KDE rendered to a canvas, then overlaid as an imageOverlay on Leaflet
// bandwidth: pixel radius of each Gaussian kernel; scale: render downsample factor (speed)
function drawKde(
  map: any,                     // Leaflet map instance
  latlngs: [number, number][],  // array of [lat, lon]
  bandwidth: number,            // px — auto-computed from zoom
  opacity: number,
  weights?: number[],           // F8: weight per point (default 1)
): HTMLCanvasElement {
  const size = map.getSize(); // {x, y}
  const canvas = document.createElement("canvas");
  canvas.width  = size.x;
  canvas.height = size.y;
  const ctx = canvas.getContext("2d")!;

  // Project all coords to pixel space relative to map container, with weights
  const pixels = latlngs.map(([lat, lon], i) => {
    const pt = map.latLngToContainerPoint([lat, lon]);
    return [pt.x, pt.y, weights ? weights[i] || 0 : 1] as [number, number, number];
  }).filter(p => p[2] > 0);

  // Downsample resolution for speed
  const sc  = 3; // compute every 3rd pixel, bilinearly upsample
  const gw  = Math.ceil(size.x / sc);
  const gh  = Math.ceil(size.y / sc);
  const bw2 = bandwidth * bandwidth;
  const density = new Float32Array(gw * gh);
  let maxD = 0;

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const cx = gx * sc + sc / 2;
      const cy = gy * sc + sc / 2;
      let d = 0;
      for (const [px, py, w] of pixels) {
        const dx = cx - px, dy = cy - py;
        d += w * Math.exp(-(dx * dx + dy * dy) / (2 * bw2));
      }
      density[gy * gw + gx] = d;
      if (d > maxD) maxD = d;
    }
  }

  if (maxD === 0) return canvas;

  // Color stops (t=0..1) → RGBA
  const stops = [
    [0.00, 0,   0,   255, 0  ],
    [0.08, 0,   180, 255, 80 ],
    [0.25, 0,   255, 120, 140],
    [0.45, 120, 255, 0,   170],
    [0.65, 255, 220, 0,   190],
    [0.82, 255, 100, 0,   200],
    [1.00, 255, 0,   0,   215],
  ] as const;

  function lerp(t: number): [number, number, number, number] {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [ta, ra, ga, ba, aa] = stops[i - 1];
        const [tb, rb, gb, bb, ab] = stops[i];
        const f = (t - ta) / (tb - ta);
        return [
          Math.round(ra + f * (rb - ra)),
          Math.round(ga + f * (gb - ga)),
          Math.round(ba + f * (bb - ba)),
          Math.round(aa + f * (ab - aa)),
        ];
      }
    }
    return [255, 0, 0, 215];
  }

  const imgData = ctx.createImageData(size.x, size.y);
  const globalAlpha = Math.max(0, Math.min(1, opacity));

  for (let py = 0; py < size.y; py++) {
    for (let px = 0; px < size.x; px++) {
      const gx = Math.min(Math.floor(px / sc), gw - 1);
      const gy = Math.min(Math.floor(py / sc), gh - 1);
      const t  = density[gy * gw + gx] / maxD;
      if (t < 0.04) continue;
      const [r, g, b, a] = lerp(t);
      const idx = (py * size.x + px) * 4;
      imgData.data[idx]     = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = Math.round(a * globalAlpha);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// ── UTM → WGS84 conversion (WGS84 ellipsoid, Bowring series) ─────────────────
function utmToLatLon(
  easting: number,
  northing: number,
  zone: number,
  southern: boolean,
): { lat: number; lon: number } | null {
  const a  = 6378137.0;
  const f  = 1 / 298.257223563;
  const k0 = 0.9996;
  const E0 = 500000.0;
  const N0 = southern ? 10000000.0 : 0.0;
  const e2 = 2 * f - f * f;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x  = easting - E0;
  const y  = northing - N0;
  const M  = y / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
  const phi1 =
    mu +
    (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    (151 * e1 ** 3 / 96) * Math.sin(6 * mu) +
    (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = (e2 / (1 - e2)) * Math.cos(phi1) ** 2;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) ** 2, 1.5);
  const D  = x / (N1 * k0);
  const lat =
    phi1 -
    (N1 * Math.tan(phi1) / R1) *
      (D ** 2 / 2 -
        (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * (e2 / (1 - e2))) * (D ** 4 / 24) +
        (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * (e2 / (1 - e2)) - 3 * C1 ** 2) * (D ** 6 / 720));
  const lon0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const lon  =
    lon0 +
    (D -
      (1 + 2 * T1 + C1) * (D ** 3 / 6) +
      (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * (e2 / (1 - e2)) + 24 * T1 ** 2) *
        (D ** 5 / 120)) /
      Math.cos(phi1);
  const latDeg = lat * (180 / Math.PI);
  const lonDeg = lon * (180 / Math.PI);
  // Brazil + neighbouring countries bounding box (generous)
  if (latDeg < -36 || latDeg > 8 || lonDeg < -76 || lonDeg > -26) return null;
  return { lat: latDeg, lon: lonDeg };
}

/** Extract a numeric UTM zone from strings like "23", "23S", "23L", "Fuso 23" */
function parseZone(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/\d+/);
  return m ? parseInt(m[0]) : null;
}

/**
 * Smart coordinate parser — handles all formats found in Brazilian ecological surveys:
 *   • Decimal degrees  (e.g. -15.7902,  -47.8823)
 *   • UTM southern     (e.g. easting=800696, northing=9422862)
 *   • UTM northern     (e.g. northing=300000, which is uncommon but possible near equator)
 *   • Comma decimal    (e.g. "-15,7902")
 *   • Swapped fields   (northing in lat column, easting in lon column)
 *
 * Detection rules:
 *   - Both values within [-90, 90] and [-180, 180] → decimal degrees (lat, lon)
 *   - One value looks like easting (100 000–999 999) and other looks like northing
 *     (> 1 000 000 OR < 1 000 000 but southern-hemisphere adjusted) → UTM
 *   - Fallback: if |val| > 360, treat as UTM meters
 */
function parseCoords(
  rawA: string,
  rawB: string,
  utmZone = 23,
  zonaUtmRecord?: string | null,
): { lat: number; lon: number } | null {
  const clean = (s: string) => s.replace(",", ".").trim();
  const a = parseFloat(clean(rawA));
  const b = parseFloat(clean(rawB));
  if (isNaN(a) || isNaN(b)) return null;

  // 1. Both fit in decimal-degree ranges → assume WGS84
  const looksDecimal = (v: number) => Math.abs(v) <= 180;
  if (looksDecimal(a) && looksDecimal(b)) {
    // Validate they look like a real coordinate (not both 0, etc.)
    if (a === 0 && b === 0) return null;
    // Swap lat/lon if needed (lon should be negative for Brazil)
    if (Math.abs(a) > 90 && Math.abs(b) <= 90) return { lat: b, lon: a };
    return { lat: a, lon: b };
  }

  // 2. At least one value is large → UTM meters
  // Determine zone: prefer per-record zone, then fall back to parameter
  const zone = parseZone(zonaUtmRecord) ?? utmZone;

  // Identify easting vs northing:
  //   Easting in Brazil: always 100 000 – 999 999 (6 digits)
  //   Northing (southern hemi, N0=10M): 6 000 000 – 10 200 000
  //   Northing (northern hemi, N0=0):   0 – 1 000 000  (rare in Brazil, only far north)
  const isEasting  = (v: number) => Math.abs(v) >= 100000 && Math.abs(v) < 1000000;
  const isNorthing = (v: number) => Math.abs(v) >= 1000000;

  let easting: number, northing: number, southern: boolean;

  if (isEasting(a) && isNorthing(b)) {
    easting = Math.abs(a); northing = Math.abs(b);
  } else if (isEasting(b) && isNorthing(a)) {
    easting = Math.abs(b); northing = Math.abs(a);
  } else if (isEasting(a) && isEasting(b)) {
    // Both look like easting — pick larger as northing (less common, but handle it)
    easting = Math.min(Math.abs(a), Math.abs(b));
    northing = Math.max(Math.abs(a), Math.abs(b));
  } else {
    // Both large — heuristic: smaller = easting, larger = northing
    easting  = Math.min(Math.abs(a), Math.abs(b));
    northing = Math.max(Math.abs(a), Math.abs(b));
  }

  // Detect hemisphere: northing > 5 000 000 in southern-hemi convention
  southern = northing > 5000000;

  // Try with detected hemisphere first, then flip if out-of-bounds
  return utmToLatLon(easting, northing, zone, southern)
    ?? utmToLatLon(easting, northing, zone, !southern);
}

function isUtm(a: number, b: number): boolean {
  return Math.abs(a) > 180 || Math.abs(b) > 180;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface MapRegistro {
  id: number;
  latitude?: string;
  longitude?: string;
  zonaUtm?: string | null;
  nomeCientifico?: string;
  nomeComum?: string;
  grupoTaxonomico?: string;
  campanha?: string;
  data?: string;
  unidadeAmostral?: string;
  iucn?: string;
  ibamaMma?: string;
  cites?: string;
  pan?: string;
  fotos?: { id: number; url: string }[];
}

// ── Color maps ────────────────────────────────────────────────────────────
const GRUPO_COLORS: Record<string, string> = {
  fauna_aves:          "#0ea5e9",
  fauna_mamiferos:     "#f59e0b",
  fauna_herpetofauna:  "#22c55e",
  fauna_ictiofauna:    "#3b82f6",
  fauna_invertebrados: "#a855f7",
  flora:               "#10b981",
  ruido:               "#f97316",
  solo:                "#92400e",
  qualidade_agua:      "#06b6d4",
  // Aliases from import dialog
  avifauna:            "#0ea5e9",
  mastofauna:          "#f59e0b",
  herpetofauna:        "#22c55e",
  ictiofauna:          "#3b82f6",
  invertebrados:       "#a855f7",
  quiropteros:         "#8b5cf6",
};

// Extra palette for groups not in GRUPO_COLORS (custom/unknown groups)
const EXTRA_PALETTE = [
  "#e11d48", "#0891b2", "#7c3aed", "#be123c", "#0369a1",
  "#059669", "#d97706", "#db2777", "#0284c7", "#15803d",
  "#9f1239", "#1d4ed8", "#6d28d9", "#b45309", "#0e7490",
];

// Assign deterministic colors to unknown groups from the extra palette
function buildGroupColors(groups: string[]): Record<string, string> {
  const map: Record<string, string> = { ...GRUPO_COLORS };
  let idx = 0;
  groups.forEach(g => {
    if (!map[g]) { map[g] = EXTRA_PALETTE[idx % EXTRA_PALETTE.length]; idx++; }
  });
  return map;
}

const GRUPO_LABEL: Record<string, string> = {
  fauna_aves:          "Aves",
  fauna_mamiferos:     "Mamíferos",
  fauna_herpetofauna:  "Herpetofauna",
  fauna_ictiofauna:    "Ictiofauna",
  fauna_invertebrados: "Invertebrados",
  flora:               "Flora",
  ruido:               "Ruído",
  solo:                "Solo",
  qualidade_agua:      "Qual. Água",
  // Aliases from import dialog
  avifauna:            "Aves",
  mastofauna:          "Mamíferos",
  herpetofauna:        "Herpetofauna",
  ictiofauna:          "Ictiofauna",
  invertebrados:       "Invertebrados",
  quiropteros:         "Quirópteros",
};

const IUCN_COLORS: Record<string, string> = {
  CR: "#dc2626", EX: "#7c3aed", EW: "#7c3aed",
  EN: "#ea580c", VU: "#ca8a04", NT: "#65a30d", LC: "#6b7280", DD: "#94a3b8",
};

const THREAT_LEVELS = ["CR", "EX", "EW", "EN", "VU", "NT", "DD"];

// ── Marker HTML factory ───────────────────────────────────────────────────
function makeMarkerHtml(
  color: string,
  isRisk: boolean,
  riskColor: string,
  size = 32,
  isOutlier = false,
): string {
  const border = isOutlier ? "#f59e0b" : (isRisk ? riskColor : "rgba(255,255,255,0.85)");
  const glow   = isOutlier
    ? `box-shadow:0 0 0 4px #f59e0baa,0 0 14px #f59e0bdd,0 3px 12px rgba(0,0,0,0.4);`
    : (isRisk ? `box-shadow:0 0 0 3px ${riskColor}55,0 3px 10px rgba(0,0,0,0.35);` : "box-shadow:0 2px 8px rgba(0,0,0,0.3);");
  const pulse  = isOutlier
    ? `<div class="campo-pulse" style="position:absolute;inset:-12px;border-radius:50%;border:3px dashed #f59e0b;pointer-events:none;"></div>
       <div style="position:absolute;top:-10px;right:-10px;width:22px;height:22px;background:#f59e0b;color:white;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;box-shadow:0 1px 4px rgba(0,0,0,0.4);z-index:2;">!</div>`
    : (isRisk
      ? `<div class="campo-pulse" style="position:absolute;inset:-8px;border-radius:50%;border:2.5px solid ${riskColor};pointer-events:none;"></div>`
      : "");
  // Pin shape: circle body + small triangle point at bottom
  const bodySize = size;
  const tipH = Math.round(size * 0.38);
  return `
    <div style="position:relative;width:${bodySize}px;height:${bodySize + tipH}px;display:flex;flex-direction:column;align-items:center">
      ${pulse}
      <div style="width:${bodySize}px;height:${bodySize}px;border-radius:50%;background:${color};border:2.5px solid ${border};${glow}display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <div style="width:${Math.round(bodySize * 0.35)}px;height:${Math.round(bodySize * 0.35)}px;border-radius:50%;background:rgba(255,255,255,0.7)"></div>
      </div>
      <div style="width:0;height:0;border-left:${Math.round(bodySize*0.3)}px solid transparent;border-right:${Math.round(bodySize*0.3)}px solid transparent;border-top:${tipH}px solid ${color};margin-top:-1px"></div>
    </div>`;
}

// ── Component ─────────────────────────────────────────────────────────────
interface CampoMapProps {
  registros: MapRegistro[];
  height?: number;
  onEditClick?: (id: number) => void;
  outlierIds?: Set<number> | number[] | null;
  focused?: { id: number; nonce: number } | null;
}

type PointRecord = MapRegistro & { lat: number; lon: number };

export function CampoMap({ registros, height = 460, onEditClick, outlierIds, focused }: CampoMapProps) {
  const outlierSet = useMemo(() => {
    if (!outlierIds) return new Set<number>();
    return outlierIds instanceof Set ? outlierIds : new Set<number>(outlierIds);
  }, [outlierIds]);
  const [expanded, setExpanded]         = useState(false);
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());
  const [utmZone, setUtmZone]           = useState(23);
  const [listOpen, setListOpen]         = useState(true);
  const [search, setSearch]             = useState("");
  const [hotspotMode, setHotspotMode]   = useState<"off" | "pontos" | "ameacadas" | "riqueza">("off");
  const showKernel = hotspotMode !== "off";
  const [selectedRecord, setSelectedRecord] = useState<PointRecord | null>(null);
  const [hoveredRecord, setHoveredRecord]   = useState<PointRecord | null>(null);
  const [hoverPos, setHoverPos]             = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mapReady, setMapReady]             = useState(false);
  const mapRef         = useRef<any>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const layersRef      = useRef<any[]>([]);
  const markerMapRef   = useRef<Map<number, any>>(new Map());
  const kernelLayerRef = useRef<any>(null);   // current imageOverlay for KDE
  const kernelTimerRef = useRef<any>(null);   // debounce timer
  const h = expanded ? 640 : height;

  const hasUtm = useMemo(() => registros.some(r => {
    if (!r.latitude || !r.longitude) return false;
    const a = parseFloat(String(r.latitude).replace(",", "."));
    const b = parseFloat(String(r.longitude).replace(",", "."));
    return isUtm(a, b);
  }), [registros]);

  const points = useMemo<PointRecord[]>(() => registros
    .filter(r => r.latitude && r.longitude)
    .map(r => {
      const coords = parseCoords(
        String(r.latitude),
        String(r.longitude),
        utmZone,
        r.zonaUtm,   // per-record zone wins when set
      );
      return coords ? { ...r, lat: coords.lat, lon: coords.lon } : null;
    })
    .filter(Boolean) as PointRecord[], [registros, utmZone]);

  const groups = useMemo(() => [...new Set(points.map(p => p.grupoTaxonomico || "outros"))], [points]);

  // Auto-assign distinct colors to all groups (including custom/unknown ones)
  const dynamicColors = useMemo(() => buildGroupColors(groups), [groups]);

  const visible = useMemo(() =>
    (!activeGroups.size ? points : points.filter(p => activeGroups.has(p.grupoTaxonomico || "outros")))
  , [points, activeGroups]);

  // Sorted list for the point panel (threatened first)
  const listPoints = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...visible]
      .filter(r => !term ||
        (r.nomeCientifico || "").toLowerCase().includes(term) ||
        (r.nomeComum || "").toLowerCase().includes(term) ||
        (r.unidadeAmostral || "").toLowerCase().includes(term))
      .sort((a, b) => {
        const ta = THREAT_LEVELS.indexOf(a.iucn || a.ibamaMma || "");
        const tb = THREAT_LEVELS.indexOf(b.iucn || b.ibamaMma || "");
        const ra = ta >= 0 ? ta : 99;
        const rb = tb >= 0 ? tb : 99;
        return ra - rb;
      });
  }, [visible, search]);

  // ── Inject pulse CSS once ────────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("campo-pulse-style")) return;
    const style = document.createElement("style");
    style.id = "campo-pulse-style";
    style.textContent = `
      @keyframes campo-pulse-anim {
        0%   { transform: scale(1); opacity: .7; }
        70%  { transform: scale(1.7); opacity: .2; }
        100% { transform: scale(2.1); opacity: 0; }
      }
      .campo-pulse { animation: campo-pulse-anim 1.8s ease-out infinite; }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Initialize map once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map = L.map(containerRef.current, {
        center: [-15.788, -47.879],
        zoom: 5,
        scrollWheelZoom: true,
        zoomAnimation: true,
      });
      const osm  = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>' });
      const esri = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "&copy; Esri" });
      const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenTopoMap" });
      osm.addTo(map);
      L.control.layers({ "Mapa": osm, "Satélite": esri, "Terreno": topo }, {}, { position: "topright" }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); }
    };
  }, []);

  // ── Update markers when visible changes (or map becomes ready) ────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    // Limpeza síncrona ANTES de qualquer await — evita marcadores duplicados
    layersRef.current.forEach(layer => { try { mapRef.current.removeLayer(layer); } catch (_) {} });
    layersRef.current = [];
    markerMapRef.current.clear();
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      // Segunda limpeza defensiva: caso outro then() tenha adicionado marcadores enquanto este aguardava
      layersRef.current.forEach(layer => { try { mapRef.current.removeLayer(layer); } catch (_) {} });
      layersRef.current = [];
      markerMapRef.current.clear();

      if (!visible.length) return;
      const latlngs: [number, number][] = [];

      visible.forEach(r => {
        const color     = dynamicColors[r.grupoTaxonomico || ""] || "#6b7280";
        const iucnCode  = r.iucn || "";
        const mmaCode   = r.ibamaMma || "";
        const isRisk    = THREAT_LEVELS.includes(iucnCode) || THREAT_LEVELS.includes(mmaCode);
        const riskColor = IUCN_COLORS[iucnCode] || IUCN_COLORS[mmaCode] || "#dc2626";
        const isOut     = outlierSet.has(r.id);
        const markerSize = isOut ? 38 : (isRisk ? 36 : 28);

        const icon = L.divIcon({
          className: "",
          html: makeMarkerHtml(color, isRisk, riskColor, markerSize, isOut),
          iconSize:   [markerSize, Math.round(markerSize * 1.38)],
          iconAnchor: [markerSize / 2, Math.round(markerSize * 1.38)],
          popupAnchor:[0, -Math.round(markerSize * 1.38) - 4],
        });

        const marker = L.marker([r.lat, r.lon], { icon });
        marker.on("click", () => { setSelectedRecord(r); setHoveredRecord(null); });
        marker.on("mouseover", (e: any) => {
          const pt = e.containerPoint;
          setHoverPos({ x: pt.x, y: pt.y });
          setHoveredRecord(r);
        });
        marker.on("mouseout", () => setHoveredRecord(null));

        marker.addTo(mapRef.current);
        layersRef.current.push(marker);
        markerMapRef.current.set(r.id, marker);
        latlngs.push([r.lat, r.lon]);
      });

      // Auto-fit bounds with animation (skip when external focus is active, focus effect will handle it)
      if (!focused) {
        if (latlngs.length === 1) {
          mapRef.current.flyTo(latlngs[0], 15, { duration: 1.2 });
        } else if (latlngs.length > 1) {
          mapRef.current.flyToBounds(L.latLngBounds(latlngs), { padding: [50, 50], duration: 1.0, maxZoom: 16 });
        }
      }
    });
    return () => { cancelled = true; };
  }, [visible, dynamicColors, mapReady, outlierSet]);

  // Fly-to externally-controlled focused point (e.g., from outliers dialog)
  useEffect(() => {
    if (!focused || !mapRef.current) return;
    const r = points.find(p => p.id === focused.id);
    if (!r) return;
    // Delay slightly so it runs AFTER the marker-rebuild auto-fit (~700ms)
    const t = setTimeout(() => {
      try {
        mapRef.current.flyTo([r.lat, r.lon], 15, { duration: 1.2 });
        setSelectedRecord(r);
        const m = markerMapRef.current.get(r.id);
        if (m) setTimeout(() => { try { m.openPopup?.(); } catch {} }, 1300);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [focused?.id, focused?.nonce, points]);

  // Resize when height changes
  useEffect(() => {
    if (mapRef.current) setTimeout(() => { try { mapRef.current?.invalidateSize(); } catch (_) {} }, 120);
  }, [h]);

  function toggleGroup(g: string) {
    setActiveGroups(prev => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g); else n.add(g);
      return n;
    });
  }

  function flyToPoint(r: PointRecord) {
    if (!mapRef.current) return;
    mapRef.current.flyTo([r.lat, r.lon], 16, { duration: 1.2 });
    setSelectedRecord(r);
  }

  function fitAllPoints() {
    if (!mapRef.current || !visible.length) return;
    import("leaflet").then((L) => {
      const latlngs = visible.map(r => [r.lat, r.lon] as [number, number]);
      if (latlngs.length === 1) {
        mapRef.current.flyTo(latlngs[0], 15, { duration: 1 });
      } else {
        mapRef.current.flyToBounds(L.latLngBounds(latlngs), { padding: [50, 50], duration: 1, maxZoom: 16 });
      }
    });
  }

  // ── KDE render ───────────────────────────────────────────────────────────
  const renderKernel = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    import("leaflet").then((L) => {
      // Remove old kernel layer
      if (kernelLayerRef.current) {
        try { map.removeLayer(kernelLayerRef.current); } catch (_) {}
        kernelLayerRef.current = null;
      }
      if (!showKernel || visible.length === 0) return;

      // Bandwidth: zoom-adaptive (larger bandwidth at low zoom)
      const zoom = map.getZoom();
      const bandwidth = Math.max(25, Math.min(120, 900 / Math.pow(2, zoom - 5)));

      const latlngs = visible.map(r => [r.lat, r.lon] as [number, number]);
      // F8: pesos por modo de hotspot
      // - pontos: 1 por registro (densidade de ocorrência)
      // - ameacadas: 1 se IUCN/MMA é CR/EN/VU/EW/EX/NT/DD, 0 caso contrário
      // - riqueza: 1/freq(espécie na UA) → áreas com mais espécies distintas brilham mais
      let weights: number[] | undefined;
      if (hotspotMode === "ameacadas") {
        weights = visible.map(r => (THREAT_LEVELS.includes(r.iucn || "") || THREAT_LEVELS.includes(r.ibamaMma || "")) ? 1 : 0);
      } else if (hotspotMode === "riqueza") {
        const freq = new Map<string, number>();
        visible.forEach(r => {
          const key = `${r.unidadeAmostral || "_"}::${(r.nomeCientifico || "").toLowerCase().trim() || `id${r.id}`}`;
          freq.set(key, (freq.get(key) || 0) + 1);
        });
        weights = visible.map(r => {
          const key = `${r.unidadeAmostral || "_"}::${(r.nomeCientifico || "").toLowerCase().trim() || `id${r.id}`}`;
          return 1 / (freq.get(key) || 1);
        });
      }
      const canvas  = drawKde(map, latlngs, bandwidth, 0.85, weights);

      // Build image overlay stretched to current view bounds
      const bounds = map.getBounds();
      const url    = canvas.toDataURL("image/png");
      const overlay = L.imageOverlay(url, bounds, { opacity: 1, interactive: false, zIndex: 400 });
      overlay.addTo(map);
      kernelLayerRef.current = overlay;
    });
  }, [showKernel, hotspotMode, visible]);

  // Re-render kernel on show/hide toggle or data change
  useEffect(() => {
    renderKernel();
  }, [renderKernel]);

  // Re-render kernel after map pan/zoom (debounced 300ms)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => {
      clearTimeout(kernelTimerRef.current);
      kernelTimerRef.current = setTimeout(renderKernel, 300);
    };
    map.on("moveend zoomend", handler);
    return () => { map.off("moveend zoomend", handler); };
  }, [renderKernel]);

  // Unique threatened species per category
  const threatStats = useMemo(() => {
    const iucnSp = new Map<string, string>(); // sp → code
    const mmaSp  = new Map<string, string>();
    const citesSp = new Map<string, string>();
    const panSp  = new Map<string, string>();
    visible.forEach(r => {
      const sp = r.nomeCientifico?.trim() || `Registro #${r.id}`;
      if (r.iucn && THREAT_LEVELS.includes(r.iucn)) iucnSp.set(sp, r.iucn);
      if (r.ibamaMma && THREAT_LEVELS.includes(r.ibamaMma)) mmaSp.set(sp, r.ibamaMma);
      if (r.cites) citesSp.set(sp, r.cites);
      if (r.pan) panSp.set(sp, r.pan.length > 40 ? r.pan.slice(0, 38) + "…" : r.pan);
    });
    return {
      iucn:  [...iucnSp.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      mma:   [...mmaSp.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      cites: [...citesSp.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      pan:   [...panSp.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [visible]);

  if (!points.length) {
    const withCoords = registros.filter(r => r.latitude && r.longitude);
    const withUtm    = withCoords.filter(r => {
      const a = parseFloat(String(r.latitude).replace(",", "."));
      const b = parseFloat(String(r.longitude).replace(",", "."));
      return isUtm(a, b);
    });
    return (
      <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-6 text-center">
        <MapPin className="w-8 h-8 text-muted-foreground/30" />
        {registros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado para os filtros selecionados</p>
        ) : withCoords.length === 0 ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {registros.length} registro{registros.length !== 1 ? "s" : ""} sem coordenadas GPS
            </p>
            <p className="text-xs text-muted-foreground">
              Para exibir no mapa, adicione colunas <strong>Latitude</strong>/<strong>Longitude</strong> (WGS84) ou{" "}
              <strong>Easting (X)</strong>/<strong>Northing (Y)</strong>/<strong>Zona UTM</strong> na planilha de importação.
            </p>
          </div>
        ) : withUtm.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-700">
              {withUtm.length} registro{withUtm.length !== 1 ? "s" : ""} com coordenadas UTM — conversão falhou
            </p>
            <p className="text-xs text-muted-foreground">Tente outro fuso UTM (fusos comuns no Brasil: 22, 23, 24):</p>
            <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
              <span className="text-xs text-amber-700 font-medium">Fuso UTM:</span>
              <select value={utmZone} onChange={e => setUtmZone(Number(e.target.value))}
                className="text-sm bg-transparent text-amber-800 font-bold border border-amber-300 rounded px-1 outline-none cursor-pointer">
                {[18,19,20,21,22,23,24,25].map(z => <option key={z} value={z}>{z}S</option>)}
              </select>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Coordenadas inválidas — verifique se os valores estão em graus decimais (ex: -15.7901) ou UTM.
          </p>
        )}
      </div>
    );
  }

  const threatenedCount = visible.filter(r => THREAT_LEVELS.includes(r.iucn || "") || THREAT_LEVELS.includes(r.ibamaMma || "")).length;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {visible.length}/{points.length} pontos
          {threatenedCount > 0 && (
            <span className="ml-1 flex items-center gap-0.5 text-red-600 font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {threatenedCount} ameaçadas
            </span>
          )}
        </span>

        {hasUtm && (
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            <span className="text-xs text-amber-700 font-medium">Fuso UTM:</span>
            <select value={utmZone} onChange={e => setUtmZone(Number(e.target.value))}
              className="text-xs bg-transparent text-amber-800 font-bold border-none outline-none cursor-pointer">
              {[18,19,20,21,22,23,24,25].map(z => <option key={z} value={z}>{z}S</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {groups.map(g => {
            const color  = dynamicColors[g] || "#6b7280";
            const active = !activeGroups.size || activeGroups.has(g);
            return (
              <button key={g} onClick={() => toggleGroup(g)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all"
                style={{ borderColor: color, backgroundColor: active ? color + "20" : "transparent", color: active ? color : "#9ca3af", fontWeight: active ? 600 : 400 }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: active ? color : "#d1d5db" }} />
                {GRUPO_LABEL[g] || g}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* ── F8: Hotspot mode selector (densidade / ameaçadas / riqueza) ── */}
          <div className="flex items-center rounded border border-orange-200 overflow-hidden text-xs font-medium" title="Mapa de calor — selecione o critério">
            <Flame className="w-3.5 h-3.5 text-orange-600 mx-1.5 flex-shrink-0" />
            {([
              { v: "off",        label: "Off",       cls: "" },
              { v: "pontos",     label: "Pontos",    cls: "bg-orange-500" },
              { v: "ameacadas",  label: "Ameaçadas", cls: "bg-red-600" },
              { v: "riqueza",    label: "Riqueza",   cls: "bg-violet-600" },
            ] as const).map(o => (
              <button key={o.v}
                onClick={() => setHotspotMode(o.v as any)}
                title={
                  o.v === "off"        ? "Desligar mapa de calor" :
                  o.v === "pontos"     ? "Densidade de ocorrências (todos os registros)" :
                  o.v === "ameacadas"  ? "Hotspots de espécies ameaçadas (IUCN/MMA: CR, EN, VU…)" :
                                         "Hotspots de riqueza — peso inversamente proporcional à frequência da espécie por UA"
                }
                className={`px-2 py-1 transition-colors ${
                  hotspotMode === o.v
                    ? `${o.cls} text-white`
                    : "bg-white hover:bg-orange-50 text-orange-700"
                }`}>
                {o.label}
              </button>
            ))}
          </div>

          <button onClick={fitAllPoints}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
            title="Centralizar todos os pontos">
            <Navigation className="w-3.5 h-3.5" />
            Ver todos
          </button>
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
            title={expanded ? "Recolher mapa" : "Expandir mapa"}>
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Threatened species summary cards ── */}
      {(threatStats.iucn.length > 0 || threatStats.mma.length > 0 || threatStats.cites.length > 0 || threatStats.pan.length > 0) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            { key: "iucn",  label: "IUCN",       entries: threatStats.iucn,  color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", codeFmt: (c: string) => c },
            { key: "mma",   label: "MMA/IBAMA",  entries: threatStats.mma,   color: "#b45309", bg: "#fffbeb", border: "#fcd34d", codeFmt: (c: string) => c },
            { key: "cites", label: "CITES",       entries: threatStats.cites, color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", codeFmt: (c: string) => `Ap. ${c}` },
            { key: "pan",   label: "PAN",         entries: threatStats.pan,   color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd", codeFmt: (_c: string) => "PAN" },
          ] as const).map(({ key, label, entries, color, bg, border, codeFmt }) => entries.length === 0 ? null : (
            <div key={key} className="rounded-xl border p-3" style={{ background: bg, borderColor: border }}>
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
                <span className="ml-auto text-lg font-extrabold leading-none" style={{ color }}>{entries.length}</span>
                <span className="text-[10px] font-normal" style={{ color }}>sp.</span>
              </div>
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-0.5">
                {entries.map(([sp, code]) => (
                  <div key={sp} className="flex items-start gap-1">
                    <span className="flex-shrink-0 px-1 py-0 rounded text-white text-[9px] font-bold leading-4 mt-0.5"
                      style={{ backgroundColor: color }}>{codeFmt(code)}</span>
                    <span className="text-[10px] italic leading-tight" style={{ color }}>{sp}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Map ── */}
      <div style={{ position: "relative", isolation: "isolate" }}>
        <div ref={containerRef}
          style={{ height: h, borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }} />

        {/* ── Hover tooltip ── */}
        {hoveredRecord && (() => {
          const r = hoveredRecord;
          const color     = dynamicColors[r.grupoTaxonomico || ""] || "#6b7280";
          const iucnCode  = r.iucn || "";
          const mmaCode   = r.ibamaMma || "";
          const isRisk    = THREAT_LEVELS.includes(iucnCode) || THREAT_LEVELS.includes(mmaCode);
          const riskColor = IUCN_COLORS[iucnCode] || IUCN_COLORS[mmaCode] || "#dc2626";
          const firstFoto = r.fotos?.[0];
          const TOOLTIP_W = 240;
          const TOOLTIP_H = firstFoto ? 310 : 170;
          const GAP = 12;
          // Position: right of cursor if space, otherwise left; above if near bottom
          const containerW = containerRef.current?.clientWidth  ?? 600;
          const containerH = containerRef.current?.clientHeight ?? 460;
          let tx = hoverPos.x + GAP;
          let ty = hoverPos.y - TOOLTIP_H / 2;
          if (tx + TOOLTIP_W > containerW - 8) tx = hoverPos.x - TOOLTIP_W - GAP;
          if (ty < 8) ty = 8;
          if (ty + TOOLTIP_H > containerH - 8) ty = containerH - TOOLTIP_H - 8;
          return (
            <div
              style={{
                position: "absolute",
                left: tx,
                top: ty,
                width: TOOLTIP_W,
                zIndex: 9999,
                pointerEvents: "none",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: `0 8px 32px rgba(0,0,0,0.22), 0 0 0 2px ${isRisk ? riskColor + "60" : color + "40"}`,
                background: "#fff",
                border: `1.5px solid ${isRisk ? riskColor + "50" : color + "40"}`,
              }}
            >
              {/* Photo */}
              {firstFoto && (
                <div style={{ position: "relative", width: "100%", height: 140, background: "#f1f5f9", overflow: "hidden" }}>
                  <img
                    src={`/api/campo/fotos/${firstFoto.id}/view`}
                    alt="foto"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  {r.fotos && r.fotos.length > 1 && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      background: "rgba(0,0,0,0.55)", color: "#fff",
                      borderRadius: 20, fontSize: 10, fontWeight: 700,
                      padding: "2px 7px",
                    }}>
                      +{r.fotos.length - 1} fotos
                    </div>
                  )}
                </div>
              )}
              {/* Body */}
              <div style={{ padding: "10px 12px 10px 12px" }}>
                {/* Species */}
                <p style={{ fontStyle: "italic", fontWeight: 700, fontSize: 13, color: isRisk ? riskColor : "#1e293b", margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {r.nomeCientifico || `Registro #${r.id}`}
                </p>
                {r.nomeComum && (
                  <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0", lineHeight: 1.3 }}>
                    {r.nomeComum}
                  </p>
                )}
                {/* Badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                  <span style={{ background: color, color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 600, padding: "2px 7px" }}>
                    {GRUPO_LABEL[r.grupoTaxonomico || ""] || r.grupoTaxonomico || "—"}
                  </span>
                  {iucnCode && (
                    <span style={{ background: IUCN_COLORS[iucnCode] || "#94a3b8", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "2px 7px" }}>
                      IUCN {iucnCode}
                    </span>
                  )}
                  {mmaCode && (
                    <span style={{ background: IUCN_COLORS[mmaCode] || "#b45309", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "2px 7px" }}>
                      MMA {mmaCode}
                    </span>
                  )}
                  {r.cites && (
                    <span style={{ background: r.cites === "I" ? "#dc2626" : "#f59e0b", color: "#fff", borderRadius: 20, fontSize: 10, fontWeight: 700, padding: "2px 7px" }}>
                      CITES {r.cites}
                    </span>
                  )}
                  {r.pan && (
                    <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 20, fontSize: 10, fontWeight: 600, padding: "2px 7px" }}>PAN</span>
                  )}
                </div>
                {/* Meta */}
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                  {r.data && (
                    <span style={{ fontSize: 11, color: "#475569" }}>📅 {r.data}</span>
                  )}
                  {r.campanha && (
                    <span style={{ fontSize: 11, color: "#475569" }}>🏷 {r.campanha}</span>
                  )}
                  {r.unidadeAmostral && (
                    <span style={{ fontSize: 11, color: "#475569" }}>📍 UA: {r.unidadeAmostral}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Detail panel ── */}
      {selectedRecord && (() => {
        const r = selectedRecord;
        const color     = dynamicColors[r.grupoTaxonomico || ""] || "#6b7280";
        const iucnCode  = r.iucn || "";
        const mmaCode   = r.ibamaMma || "";
        const isRisk    = THREAT_LEVELS.includes(iucnCode) || THREAT_LEVELS.includes(mmaCode);
        const riskColor = IUCN_COLORS[iucnCode] || IUCN_COLORS[mmaCode] || "#dc2626";
        return (
          <div className="border rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-200"
            style={{ borderColor: isRisk ? riskColor + "80" : "#e2e8f0", background: isRisk ? riskColor + "08" : undefined }}>
            {/* Header */}
            <div className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: color + "25", border: `2px solid ${color}` }}>
                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold italic text-sm text-foreground leading-tight">
                  {r.nomeCientifico || `Registro #${r.id}`}
                </p>
                {r.nomeComum && (
                  <p className="text-xs text-muted-foreground mt-0.5">{r.nomeComum}</p>
                )}
              </div>
              {onEditClick && (
                <button
                  onClick={() => { onEditClick(r.id); setSelectedRecord(null); }}
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                  title="Editar este registro">
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
              <button onClick={() => setSelectedRecord(null)}
                className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {/* Status badges */}
              <div className="col-span-2 flex flex-wrap gap-1.5 mb-1">
                {r.grupoTaxonomico && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[11px] font-medium"
                    style={{ backgroundColor: color }}>
                    <Layers className="w-3 h-3" />
                    {GRUPO_LABEL[r.grupoTaxonomico] || r.grupoTaxonomico}
                  </span>
                )}
                {iucnCode && (
                  <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold"
                    style={{ backgroundColor: IUCN_COLORS[iucnCode] || "#94a3b8" }}>
                    IUCN {iucnCode}
                  </span>
                )}
                {mmaCode && (
                  <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold"
                    style={{ backgroundColor: IUCN_COLORS[mmaCode] || "#1E6146" }}>
                    MMA {mmaCode}
                  </span>
                )}
                {r.cites && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.cites === "I" ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
                    CITES Ap.{r.cites}
                  </span>
                )}
                {r.pan && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-medium" title={r.pan}>
                    PAN
                  </span>
                )}
              </div>
              {/* Detail rows */}
              {r.campanha && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="w-3 h-3 flex-shrink-0" />
                  <span className="font-medium text-foreground">{r.campanha}</span>
                </div>
              )}
              {r.data && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span className="font-medium text-foreground">{r.data}</span>
                </div>
              )}
              {r.unidadeAmostral && (
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span>UA: <span className="font-medium text-foreground">{r.unidadeAmostral}</span></span>
                </div>
              )}
              <div className="col-span-2 font-mono text-[10px] text-muted-foreground/60 mt-1">
                {r.lat.toFixed(6)}, {r.lon.toFixed(6)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Legend ── */}
      {visible.some(r => r.iucn || r.ibamaMma || r.cites) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground px-1">
          <span className="font-medium">Pinos:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-red-600 bg-red-100 inline-block" />
            Ameaçada (animação)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/80 bg-blue-400 inline-block" />
            Não ameaçada
          </span>
          <span className="flex items-center gap-1.5">cor = grupo taxonômico</span>
        </div>
      )}

      {/* ── KDE legend (F8) ── */}
      {showKernel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 flex-wrap">
          <Flame className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
          <span className="font-medium text-orange-700">
            {hotspotMode === "ameacadas" ? "Hotspots de espécies ameaçadas" :
             hotspotMode === "riqueza"   ? "Hotspots de riqueza (espécies distintas)" :
                                           "Densidade de ocorrências"}:
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px]">Baixa</span>
            <div className="w-32 h-3 rounded-full flex-shrink-0"
              style={{ background: "linear-gradient(to right, rgba(0,180,255,0.5), rgba(0,255,120,0.65), rgba(120,255,0,0.7), rgba(255,220,0,0.75), rgba(255,100,0,0.78), rgba(255,0,0,0.84))" }} />
            <span className="text-[10px]">Alta</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60">
            {hotspotMode === "ameacadas" ? "· KDE ponderada por status de ameaça (IUCN/MMA)" :
             hotspotMode === "riqueza"   ? "· KDE ponderada por 1/freq(espécie na UA)" :
                                           "· Gaussiano adaptativo ao zoom"}
          </span>
        </div>
      )}

      {/* ── Point list panel ── */}
      <div className="border rounded-xl overflow-hidden">
        <button
          onClick={() => setListOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium">
          <span className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600" />
            Navegar entre pontos
            <span className="text-xs text-muted-foreground font-normal">({listPoints.length})</span>
          </span>
          {listOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {listOpen && (
          <>
            {/* Search bar */}
            <div className="px-3 pt-2 pb-1 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar espécie, UA..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-52 overflow-y-auto divide-y">
              {listPoints.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">Nenhum ponto encontrado</p>
              )}
              {listPoints.map(r => {
                const color     = dynamicColors[r.grupoTaxonomico || ""] || "#6b7280";
                const iucnCode  = r.iucn || "";
                const mmaCode   = r.ibamaMma || "";
                const isRisk    = THREAT_LEVELS.includes(iucnCode) || THREAT_LEVELS.includes(mmaCode);
                const riskColor = IUCN_COLORS[iucnCode] || IUCN_COLORS[mmaCode] || "#dc2626";
                return (
                  <div key={r.id}
                    className={`px-3 py-2 hover:bg-muted/40 transition-colors ${isRisk ? "bg-red-50/50" : ""}`}>
                    {/* Row 1: dot + species name + Ir button */}
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-2 h-2 rounded-full"
                        style={{ backgroundColor: color, boxShadow: isRisk ? `0 0 0 2px ${riskColor}` : undefined }} />
                      <p className="flex-1 min-w-0 text-xs font-semibold italic truncate"
                        style={{ color: isRisk ? riskColor : "inherit" }}>
                        {r.nomeCientifico || `Registro #${r.id}`}
                      </p>
                      <button
                        onClick={() => flyToPoint(r)}
                        className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title="Ir ao ponto no mapa">
                        <Navigation className="w-3 h-3" />
                        Ir
                      </button>
                      {onEditClick && (
                        <button
                          onClick={() => { flyToPoint(r); onEditClick(r.id); }}
                          className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
                          title="Editar este registro">
                          <Pencil className="w-3 h-3" />
                          Editar
                        </button>
                      )}
                    </div>
                    {/* Row 2: common name + meta + badges */}
                    <div className="flex items-center flex-wrap gap-1 pl-4 mt-0.5">
                      {r.nomeComum && (
                        <span className="text-[10px] text-muted-foreground italic mr-1 truncate max-w-[120px]">{r.nomeComum}</span>
                      )}
                      {r.unidadeAmostral && (
                        <span className="text-[10px] text-muted-foreground">UA: {r.unidadeAmostral}</span>
                      )}
                      {r.campanha && (
                        <span className="text-[10px] text-muted-foreground">· {r.campanha}</span>
                      )}
                      {iucnCode && (
                        <span className="px-1 py-0 rounded text-white text-[9px] font-bold"
                          style={{ backgroundColor: IUCN_COLORS[iucnCode] || "#94a3b8" }}>IUCN {iucnCode}</span>
                      )}
                      {mmaCode && (
                        <span className="px-1 py-0 rounded text-white text-[9px] font-bold"
                          style={{ backgroundColor: IUCN_COLORS[mmaCode] || "#b45309" }}>MMA {mmaCode}</span>
                      )}
                      {r.cites && (
                        <span className={`px-1 py-0 rounded text-[9px] font-bold ${r.cites === "I" ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>CITES {r.cites}</span>
                      )}
                      {r.pan && (
                        <span className="px-1 py-0 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">PAN</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
