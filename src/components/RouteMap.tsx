import React, { useMemo } from 'react';
import { Map as MapIcon, Download, ExternalLink } from 'lucide-react';

/** Punto geografico del percorso (dal rilevamento GPS o dal profilo importato). */
export interface RouteMapPoint {
  distanceM: number;
  latitude: number;
  longitude: number;
  elevationZ?: number;
}

/** Macchina posizionata lungo il percorso, indicata sulla mappa in base alla progressiva. */
export interface RouteMapMarker {
  distanceM: number;
  kind: 'pump';
  label: string;
}

interface RouteMapProps {
  points: RouteMapPoint[];
  markers?: RouteMapMarker[];
  /** Nome usato nel file GPX e nella mappa. */
  title?: string;
  /** Altezza in pixel del riquadro mappa. */
  height?: number;
}

const EARTH_M_PER_DEG_LAT = 110540;
const EARTH_M_PER_DEG_LON = 111320;

const isUsable = (p: RouteMapPoint): boolean =>
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180;

/** Interpola le coordinate alla progressiva richiesta lungo la spezzata del percorso. */
function interpolateGeo(
  pts: RouteMapPoint[],
  distanceM: number
): { latitude: number; longitude: number } | null {
  if (pts.length === 0) return null;
  if (distanceM <= pts[0].distanceM) {
    return { latitude: pts[0].latitude, longitude: pts[0].longitude };
  }
  const last = pts[pts.length - 1];
  if (distanceM >= last.distanceM) {
    return { latitude: last.latitude, longitude: last.longitude };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
      const span = b.distanceM - a.distanceM;
      const t = span > 0 ? (distanceM - a.distanceM) / span : 0;
      return {
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t
      };
    }
  }
  return { latitude: last.latitude, longitude: last.longitude };
}

/** Lunghezza "tonda" della barra di scala, scelta per stare fra 60 e 200 px. */
function niceScaleBar(metresPerPx: number): { metres: number; px: number } {
  const candidates = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  for (const metres of candidates) {
    const px = metres / metresPerPx;
    if (px >= 60 && px <= 200) return { metres, px };
  }
  const metres = candidates[candidates.length - 1];
  return { metres, px: Math.min(200, metres / metresPerPx) };
}

/** Protegge il testo inserito nel file GPX (&, <, >, "). */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildGpx(points: RouteMapPoint[], markers: RouteMapMarker[], title: string): string {
  const trkpts = points
    .map(
      p =>
        `      <trkpt lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}">` +
        (p.elevationZ !== undefined ? `<ele>${p.elevationZ.toFixed(1)}</ele>` : '') +
        `</trkpt>`
    )
    .join('\n');

  const wpts = markers
    .map(m => {
      const geo = interpolateGeo(points, m.distanceM);
      if (!geo) return '';
      const name = `${m.label || 'Motopompa'} ${m.distanceM.toFixed(0)} m`;
      return (
        `  <wpt lat="${geo.latitude.toFixed(7)}" lon="${geo.longitude.toFixed(7)}">` +
        `<name>${escapeXml(name)}</name>` +
        `</wpt>`
      );
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="IdroCondotta VVF" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(title)}</name></metadata>
${wpts ? wpts + '\n' : ''}  <trk>
    <name>${escapeXml(title)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Riduce la traccia a un massimo di punti, per non rendere enorme l'URL. */
function downsample(points: RouteMapPoint[], maxPoints: number): RouteMapPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const sampled: RouteMapPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(points[Math.round(i * step)]);
  }
  return sampled;
}

/** Codifica una stringa UTF-8 in base64 (btoa accetta solo caratteri a un byte). */
function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Link che apre il percorso su geojson.io: la traccia (e le macchine) sono
 * già disegnate e inquadrate, e dal menù "Layers" si sceglie il livello
 * OpenStreetMap. I punti sono ridotti per contenere la lunghezza dell'URL.
 *
 * Il GeoJSON è codificato in base64: geojson.io rilegge il testo dopo "#data="
 * e lo passa di nuovo a `new URL()`, quindi un cancelletto dentro il GeoJSON
 * (i colori "#38bdf8", "#f59e0b") verrebbe scambiato per l'inizio del fragment
 * e i dati risulterebbero troncati ("Unterminated string in JSON").
 */
export function buildGeoJsonUrl(
  points: RouteMapPoint[],
  markers: RouteMapMarker[],
  title: string
): string {
  const usable = points
    .filter(isUsable)
    .sort((a, b) => a.distanceM - b.distanceM);
  const sampled = downsample(usable, 400);

  const features: Record<string, unknown>[] = [];

  if (sampled.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { name: title, stroke: '#38bdf8', 'stroke-width': 4, 'stroke-opacity': 0.9 },
      geometry: {
        type: 'LineString',
        coordinates: sampled.map(p => [
          Number(p.longitude.toFixed(6)),
          Number(p.latitude.toFixed(6))
        ])
      }
    });
  }

  markers.forEach(m => {
    const geo = interpolateGeo(usable, m.distanceM);
    if (!geo) return;
    features.push({
      type: 'Feature',
      properties: {
        name: `${m.label || 'Motopompa'} · ${m.distanceM.toFixed(0)} m`,
        'marker-color': '#f59e0b'
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(geo.longitude.toFixed(6)), Number(geo.latitude.toFixed(6))]
      }
    });
  });

  const geoJson = { type: 'FeatureCollection', features };
  return (
    'https://geojson.io/#data=data:application/json;base64,' +
    toBase64Utf8(JSON.stringify(geoJson))
  );
}

function downloadGpx(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Vista planimetrica del percorso con le coordinate GPS. Disegnata come SVG
 * inline (funziona anche senza rete) più i collegamenti per aprirla su una
 * mappa vera o scaricare la traccia GPX.
 */
export const RouteMap: React.FC<RouteMapProps> = ({
  points,
  markers = [],
  title = 'Percorso condotta',
  height = 300
}) => {
  const usable = useMemo(
    () => points.filter(isUsable).sort((a, b) => a.distanceM - b.distanceM),
    [points]
  );

  const view = useMemo(() => {
    if (usable.length < 2) return null;

    const lat0 = usable[0].latitude;
    const lon0 = usable[0].longitude;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);

    // Proiezione locale equirettangolare: metri a est (x) e a nord (y).
    const xy = usable.map(p => ({
      x: (p.longitude - lon0) * EARTH_M_PER_DEG_LON * cosLat,
      y: (p.latitude - lat0) * EARTH_M_PER_DEG_LAT
    }));

    const xs = xy.map(p => p.x);
    const ys = xy.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 1e-6);
    const spanY = Math.max(maxY - minY, 1e-6);

    const W = 720;
    const H = 300;
    const pad = 0.09;
    const innerW = W * (1 - 2 * pad);
    const innerH = H * (1 - 2 * pad);
    const scale = Math.min(innerW / spanX, innerH / spanY);

    const offX = (W - spanX * scale) / 2 - minX * scale;
    // y cresce verso nord: in SVG va invertito (origine in alto a sinistra).
    const offY = (H - spanY * scale) / 2 + maxY * scale;

    const toX = (x: number) => x * scale + offX;
    const toY = (y: number) => offY - y * scale;

    const polyline = xy.map(p => `${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ');

  const placedMarkers = markers
    .map(m => {
      const geo = interpolateGeo(usable, m.distanceM);
      if (!geo) return null;
      const x = (geo.longitude - lon0) * EARTH_M_PER_DEG_LON * cosLat;
      const y = (geo.latitude - lat0) * EARTH_M_PER_DEG_LAT;
      return { ...m, sx: toX(x), sy: toY(y) };
    })
    .filter((m): m is RouteMapMarker & { sx: number; sy: number } => m !== null);

    const latSpan = Math.max(...usable.map(p => p.latitude)) - Math.min(...usable.map(p => p.latitude));
    const lonSpan = Math.max(...usable.map(p => p.longitude)) - Math.min(...usable.map(p => p.longitude));
    const spanDeg = Math.max(latSpan, lonSpan);
    const zoom =
      spanDeg > 0.5 ? 11 : spanDeg > 0.2 ? 12 : spanDeg > 0.1 ? 13 : spanDeg > 0.05 ? 14 : spanDeg > 0.02 ? 15 : spanDeg > 0.01 ? 16 : 17;

    const centre = {
      lat: (Math.min(...usable.map(p => p.latitude)) + Math.max(...usable.map(p => p.latitude))) / 2,
      lon: (Math.min(...usable.map(p => p.longitude)) + Math.max(...usable.map(p => p.longitude))) / 2
    };

    const metresPerPx = 1 / scale;
    const scaleBar = niceScaleBar(metresPerPx);

    return {
      W,
      H,
      polyline,
      markers: placedMarkers,
      start: { x: toX(xy[0].x), y: toY(xy[0].y) },
      end: { x: toX(xy[xy.length - 1].x), y: toY(xy[xy.length - 1].y) },
      zoom,
      centre,
      scaleBar,
      metresPerPx
    };
  }, [usable, markers]);

  if (usable.length < 2 || !view) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-center gap-2">
        <MapIcon className="w-4 h-4 shrink-0" />
        <span>
          Nessuna coordinata geografica disponibile: la mappa compare dopo un rilevamento GPS
          (o importando un file con latitudine e longitudine).
        </span>
      </div>
    );
  }

  const osmUrl = `https://www.openstreetmap.org/?mlat=${view.centre.lat.toFixed(6)}&mlon=${view.centre.lon.toFixed(
    6
  )}#map=${view.zoom}/${view.centre.lat.toFixed(6)}/${view.centre.lon.toFixed(6)}`;

  // Il percorso intero, già disegnato, si apre su geojson.io (livello OSM dal menù "Layers").
  const geoJsonUrl = buildGeoJsonUrl(usable, markers, title);

  const safeName = title.replace(/[^\w\-]+/g, '_').slice(0, 60) || 'percorso';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <MapIcon className="w-4 h-4 text-emerald-400" />
          Vista planimetrica del percorso
          <span className="text-slate-500 font-normal font-mono">
            {usable.length} punti · {view.metresPerPx.toFixed(2)} m/px
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Apri solo il centro del percorso su OpenStreetMap"
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Punto
          </a>
          <a
            href={geoJsonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-md bg-sky-700 hover:bg-sky-600 text-white transition"
            title="Apri l'intero percorso su geojson.io (traccia già disegnata; livello OpenStreetMap dal menù Layers)"
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Vedi mappa del percorso
          </a>
          <button
            onClick={() => downloadGpx(buildGpx(usable, markers, title), `${safeName}.gpx`)}
            className="inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-md bg-emerald-700 hover:bg-emerald-600 text-white transition cursor-pointer"
            title="Scarica la traccia GPX (gpx.studio, Google Earth, QGIS, Garmin...)"
          >
            <Download className="w-3 h-3 mr-1" /> GPX
          </button>
        </div>
      </div>

      <div style={{ height }}>
        <svg
          viewBox={`0 0 ${view.W} ${view.H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full bg-slate-950"
        >
          {/* Griglia di riferimento */}
          <defs>
            <pattern id="route-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgb(30 41 59)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={view.W} height={view.H} fill="url(#route-grid)" />

          {/* Tracciato */}
          <polyline
            points={view.polyline}
            fill="none"
            stroke="rgb(56 189 248)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Macchine */}
          {view.markers.map((m, i) => (
            <g key={`${m.kind}-${m.distanceM}-${i}`}>
              <circle
                cx={m.sx}
                cy={m.sy}
                r="6"
                fill={m.kind === 'pump' ? 'rgb(251 191 36)' : 'rgb(56 189 248)'}
                stroke="rgb(2 6 23)"
                strokeWidth="1.5"
              />
              <text
                x={m.sx + 9}
                y={m.sy + 3.5}
                fill="rgb(203 213 225)"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {m.distanceM.toFixed(0)} m
              </text>
            </g>
          ))}

          {/* Partenza e arrivo */}
          <circle cx={view.start.x} cy={view.start.y} r="7" fill="rgb(16 185 129)" stroke="rgb(2 6 23)" strokeWidth="2" />
          <circle cx={view.end.x} cy={view.end.y} r="7" fill="rgb(244 63 94)" stroke="rgb(2 6 23)" strokeWidth="2" />

          {/* Nord */}
          <g transform={`translate(${view.W - 34}, 34)`}>
            <path d="M 0 -14 L 6 10 L 0 5 L -6 10 Z" fill="rgb(148 163 184)" />
            <text x="0" y="24" fill="rgb(148 163 184)" fontSize="11" textAnchor="middle">
              N
            </text>
          </g>

          {/* Barra di scala */}
          <g transform={`translate(20, ${view.H - 22})`}>
            <line x1="0" y1="0" x2={view.scaleBar.px} y2="0" stroke="rgb(148 163 184)" strokeWidth="2" />
            <line x1="0" y1="-5" x2="0" y2="5" stroke="rgb(148 163 184)" strokeWidth="2" />
            <line
              x1={view.scaleBar.px}
              y1="-5"
              x2={view.scaleBar.px}
              y2="5"
              stroke="rgb(148 163 184)"
              strokeWidth="2"
            />
            <text x={view.scaleBar.px / 2} y="-9" fill="rgb(148 163 184)" fontSize="11" textAnchor="middle">
              {view.scaleBar.metres >= 1000
                ? `${(view.scaleBar.metres / 1000).toFixed(view.scaleBar.metres % 1000 === 0 ? 0 : 1)} km`
                : `${view.scaleBar.metres} m`}
            </text>
          </g>

          <g transform={`translate(${view.W - 34}, ${view.H - 18})`} opacity="0.7">
            <text x="0" y="0" fill="rgb(100 116 139)" fontSize="10" textAnchor="end">
              coordinate WGS84
            </text>
          </g>
        </svg>
      </div>

      <div className="px-3 py-2 border-t border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Partenza
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Arrivo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Motopompa
        </span>
      </div>
    </div>
  );
};
