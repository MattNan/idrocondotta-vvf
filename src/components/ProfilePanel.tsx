import React, { useMemo, useState } from 'react';
import {
  Mountain,
  Plus,
  Trash2,
  Upload,
  Navigation,
  Eye,
  EyeOff,
  MapPin
} from 'lucide-react';
import { ProfilePoint, GpsTrackPoint } from '../types';
import { RouteMap, RouteMapMarker, RouteMapPoint } from './RouteMap';

interface ProfilePanelProps {
  profile: ProfilePoint[];
  onChangeProfile: (next: ProfilePoint[]) => void;
  onOpenImport: () => void;
  onOpenGps: () => void;
  highlightStationM?: number;
  /** Percorso GPS a piena risoluzione, se disponibile. */
  track?: GpsTrackPoint[];
  /** Macchine da indicare sulla mappa. */
  mapMarkers?: RouteMapMarker[];
}

const sortProfile = (pts: ProfilePoint[]) => [...pts].sort((a, b) => a.distanceM - b.distanceM);

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  profile,
  onChangeProfile,
  onOpenImport,
  onOpenGps,
  highlightStationM,
  track,
  mapMarkers
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [newDistanceM, setNewDistanceM] = useState<number | ''>('');
  const [newElevationM, setNewElevationM] = useState<number | ''>('');
  const [showMap, setShowMap] = useState(false);

  const sorted = sortProfile(profile);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const deltaZ = first && last ? last.elevationZ - first.elevationZ : 0;

  /**
   * Punti per la mappa: si preferisce il percorso GPS a piena risoluzione,
   * altrimenti si usano i punti del profilo che portano le coordinate.
   */
  const mapPoints = useMemo<RouteMapPoint[]>(() => {
    const usableTrack = (track ?? []).filter(
      t => Number.isFinite(t.latitude) && Number.isFinite(t.longitude)
    );
    if (usableTrack.length >= 2) return usableTrack;

    return sorted
      .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map(p => ({
        distanceM: p.distanceM,
        elevationZ: p.elevationZ,
        latitude: p.latitude as number,
        longitude: p.longitude as number
      }));
  }, [track, sorted]);

  const geoPoints = sorted.filter(
    p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  ).length;

  const handleUpdate = (id: string, updates: Partial<ProfilePoint>) => {
    onChangeProfile(sortProfile(profile.map(p => (p.id === id ? { ...p, ...updates } : p))));
  };

  const handleDelete = (id: string) => {
    if (profile.length <= 2) {
      alert('Il profilo deve contenere almeno il punto di partenza e il punto di arrivo.');
      return;
    }
    onChangeProfile(profile.filter(p => p.id !== id));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDistanceM === '' || newElevationM === '') return;

    const point: ProfilePoint = {
      id: `pt-${Date.now()}`,
      distanceM: Number(newDistanceM),
      elevationZ: Number(newElevationM)
    };
    onChangeProfile(sortProfile([...profile, point]));
    setNewDistanceM('');
    setNewElevationM('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900">
        <div className="flex items-center space-x-2 min-w-0">
          <Mountain className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-semibold text-slate-200 uppercase tracking-wider truncate">
            Profilo Plano-Altimetrico
          </h3>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 shrink-0">
            {sorted.length} punti
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="hidden sm:block text-[11px] text-slate-400 font-mono">
            {first ? `${first.distanceM.toFixed(0)}–${last.distanceM.toFixed(0)} m` : '—'} · ΔZ{' '}
            {deltaZ >= 0 ? '+' : ''}
            {deltaZ.toFixed(0)} m
          </span>
          {/* Comando di visibilità dati (discreto) */}
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title={collapsed ? 'Mostra dati profilo' : 'Nascondi dati profilo (resta sul grafico)'}
          >
            {collapsed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Barra strumenti */}
      <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center gap-2 bg-slate-950/60">
        <button
          type="button"
          onClick={onOpenImport}
          className="inline-flex items-center px-2.5 py-1 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-medium transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 mr-1" /> Importa CSV/Excel
        </button>
        <button
          type="button"
          onClick={onOpenGps}
          className="inline-flex items-center px-2.5 py-1 bg-sky-700/80 hover:bg-sky-600 text-white rounded-lg text-[11px] font-medium transition cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 mr-1" /> GPS Live
        </button>
        <button
          type="button"
          onClick={() => setShowMap(v => !v)}
          disabled={mapPoints.length < 2}
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
            mapPoints.length >= 2
              ? 'bg-indigo-700/80 hover:bg-indigo-600 text-white cursor-pointer'
              : 'bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed'
          }`}
          title={
            mapPoints.length >= 2
              ? 'Mostra il percorso sulla mappa planimetrica'
              : 'Servono almeno due punti con coordinate GPS'
          }
        >
          <MapPin className="w-3.5 h-3.5 mr-1" />
          {showMap ? 'Nascondi mappa' : 'Vedi mappa'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                'Svuotare il profilo? Rimosseranno partenza, arrivo e tutti i punti del tracciato.'
              )
            ) {
              onChangeProfile([]);
            }
          }}
          className="inline-flex items-center px-2.5 py-1 bg-slate-800 hover:bg-red-900/60 border border-slate-700 hover:border-red-700 text-slate-400 hover:text-red-300 rounded-lg text-[11px] font-medium transition cursor-pointer"
        >
          Svuota
        </button>
        <span className="text-[10px] text-slate-500 ml-auto">
          {geoPoints > 0
            ? `${geoPoints} punti con coordinate GPS`
            : 'Distanza reale condotta e quota terreno'}
        </span>
      </div>

      {showMap && mapPoints.length >= 2 && (
        <div className="p-3 border-b border-slate-800 bg-slate-950/40">
          <RouteMap
            points={mapPoints}
            markers={mapMarkers ?? []}
            title="Percorso condotta"
          />
        </div>
      )}

      {collapsed ? (
        <div className="px-3 py-3 text-[11px] text-slate-400 bg-slate-950/40">
          Profilo impostato —{' '}
          {first ? `${first.elevationZ.toFixed(0)} → ${last.elevationZ.toFixed(0)} m s.l.m.` : '—'} su{' '}
          {last ? last.distanceM.toFixed(0) : '0'} m.{' '}
          <span className="text-sky-400">Visibile solo sul grafico.</span>
        </div>
      ) : (
        <>
          <div className="w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2 px-3 font-semibold w-40">Progressiva [m]</th>
                  <th className="py-2 px-3 font-semibold w-40">Quota Z [m s.l.m.]</th>
                  <th className="py-2 px-2 font-semibold">Ruolo</th>
                  <th className="py-2 px-1 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {sorted.map((p, i) => {
                  const isHighlighted =
                    highlightStationM !== undefined &&
                    Math.abs(p.distanceM - highlightStationM) < 1;
                  const role = i === 0 ? 'Partenza' : i === sorted.length - 1 ? 'Arrivo' : 'Tracciato';

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isHighlighted ? 'bg-sky-950/40 border-l-4 border-sky-400' : ''
                      }`}
                    >
                      <td className="py-1.5 px-3 text-slate-200">
                        <input
                          type="number"
                          value={p.distanceM}
                          onChange={e =>
                            handleUpdate(p.id, { distanceM: Number(e.target.value) })
                          }
                          className="w-28 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-sky-500 text-slate-100 font-mono py-0.5 focus:outline-hidden"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="number"
                          value={p.elevationZ}
                          onChange={e =>
                            handleUpdate(p.id, { elevationZ: Number(e.target.value) })
                          }
                          className="w-28 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-sky-500 text-emerald-400 font-mono py-0.5 focus:outline-hidden"
                        />
                      </td>
                      <td className="py-1.5 px-2 font-sans text-slate-500 text-[11px]">{role}</td>
                      <td className="py-1.5 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-slate-500 hover:text-red-400 p-1 hover:bg-red-950/40 rounded transition cursor-pointer"
                          title="Elimina punto del profilo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Aggiunta punto */}
          <form
            onSubmit={handleAdd}
            className="p-2.5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center gap-2 text-xs"
          >
            <span className="font-semibold text-slate-400 flex items-center">
              <Plus className="w-3.5 h-3.5 mr-1 text-sky-400" /> Aggiungi Punto:
            </span>
            <input
              type="number"
              placeholder="Progressiva [m]"
              value={newDistanceM}
              onChange={e => setNewDistanceM(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-hidden focus:border-sky-500"
            />
            <input
              type="number"
              placeholder="Quota Z [m]"
              value={newElevationM}
              onChange={e => setNewElevationM(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-hidden focus:border-sky-500"
            />
            <button
              type="submit"
              className="ml-auto inline-flex items-center px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Inserisci nel Profilo
            </button>
          </form>
        </>
      )}
    </div>
  );
};
