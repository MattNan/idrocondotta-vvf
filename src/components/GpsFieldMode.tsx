import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Navigation,
  Crosshair,
  MapPin,
  Play,
  Pause,
  Square,
  AlertTriangle,
  Flame,
  CheckCircle,
  Volume2,
  VolumeX,
  ArrowRight,
  Clock,
  RotateCcw,
  Gauge,
  Waves,
  Hand,
  Layers,
  Trash2
} from 'lucide-react';
import { FieldGPSTracker, GPSPoint, MIN_MOVE_M } from '../utils/gpsTracker';
import { buildTrackNodes } from '../utils/nodeModel';
import { ProjectConfig, StationNode, GpsTrackPayload, GpsTrackPoint } from '../types';
import {
  calculateHazenWilliamsUnitLoss,
  BAR_TO_METERS,
  METERS_TO_BAR
} from '../engine/hydraulicEngine';
import { getPumpCatalogue, findPumpType, calculatePumpDeliveryPressure } from '../engine/pumpCatalogue';
import { RouteMap, RouteMapMarker } from './RouteMap';
import { PumpOptions } from './PumpOptions';

interface GpsFieldModeProps {
  config: ProjectConfig;
  onApplyGpsTrack: (payload: GpsTrackPayload) => void;
  onExit: () => void;
}

type SourceMode = 'pressure' | 'suction';

/** Nome breve del modello, senza la parte fra parentesi. */
const shortPumpName = (name: string): string => name.split('(')[0].trim();

/** Portata impostabile sul campo [l/min]. */
const FLOW_OPTIONS = Array.from({ length: 21 }, (_, i) => 200 + i * 50);

/** Cadenza di registrazione dei punti: 0 = solo a mano. */
const INTERVAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'A mano' },
  { value: 5, label: '5 s' },
  { value: 10, label: '10 s' },
  { value: 15, label: '15 s' },
  { value: 20, label: '20 s' },
  { value: 30, label: '30 s' }
];

interface LivePump {
  distanceM: number;
  elevationZ: number;
  boostBar: number;
  mode: 'direct' | 'vascone_suction';
  suctionLiftM: number;
}

export const GpsFieldMode: React.FC<GpsFieldModeProps> = ({
  config,
  onApplyGpsTrack,
  onExit
}) => {
  // --- Fase GPS: acceso / in registrazione / in pausa -----------------------
  const [gpsActive, setGpsActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [intervalSec, setIntervalSec] = useState<number>(10);

  // --- Dati rilevati --------------------------------------------------------
  const [currentPoint, setCurrentPoint] = useState<GPSPoint | null>(null);
  const [recordedPoints, setRecordedPoints] = useState<GPSPoint[]>([]);
  const [fieldNodes, setFieldNodes] = useState<StationNode[]>([]);
  const [recordHint, setRecordHint] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // --- Impostazioni del punto di partenza ----------------------------------
  const [flowLpm, setFlowLpm] = useState<number>(config.targetFlowLpm);
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    config.sourcePumpConfig?.mode === 'vascone_suction' ? 'suction' : 'pressure'
  );
  const [sourcePressureBar, setSourcePressureBar] = useState<number>(config.sourcePressureBar);
  const [suctionLiftM, setSuctionLiftM] = useState<number>(3);
  const [pumpAtStart, setPumpAtStart] = useState(false);
  // Modello della motopompa di partenza.
  const [pumpTypeId, setPumpTypeId] = useState('pump-8-8');
  // Modello usato per le motopompe piazzate sul campo: è indipendente da
  // quello di partenza, così la macchina di rilancio può essere diversa.
  const [markerPumpTypeId, setMarkerPumpTypeId] = useState('pump-8-8');
  const [showMap, setShowMap] = useState(false);

  const trackerRef = useRef<FieldGPSTracker>(new FieldGPSTracker());

  const pumpCatalogue = useMemo(() => getPumpCatalogue(config.pumpTypes), [config.pumpTypes]);
  const selectedPump = useMemo(
    () => findPumpType(pumpTypeId, config.pumpTypes),
    [pumpTypeId, config.pumpTypes]
  );
  const selectedMarkerPump = useMemo(
    () => findPumpType(markerPumpTypeId, config.pumpTypes),
    [markerPumpTypeId, config.pumpTypes]
  );

  // --- Perdite di carico alla portata scelta -------------------------------
  const unitLoss = calculateHazenWilliamsUnitLoss(flowLpm, config.defaultDiameterMm, config.hazenWilliamsC);
  const lossFactor = 1 + config.localizedLossPercent / 100;

  // --- Posizione "live" -----------------------------------------------------
  const lastRecorded = recordedPoints[recordedPoints.length - 1];
  const startPointZ = recordedPoints[0]?.altitudeM ?? currentPoint?.altitudeM ?? 0;
  const currentZ = currentPoint?.altitudeM ?? lastRecorded?.altitudeM ?? startPointZ;
  const liveDistanceDiagM = currentPoint?.cumulativeDiagM ?? lastRecorded?.cumulativeDiagM ?? 0;
  const liveDistancePlanM = currentPoint?.cumulativeDistM ?? lastRecorded?.cumulativeDistM ?? 0;
  const deltaZ = currentZ - startPointZ;

  // --- Pompe attive (partenza + marcate sul campo) --------------------------
  const livePumps = useMemo<LivePump[]>(() => {
    const list: LivePump[] = [];

    if (pumpAtStart) {
      const type = findPumpType(pumpTypeId, config.pumpTypes);
      const op = calculatePumpDeliveryPressure(type, flowLpm);
      list.push({
        distanceM: 0,
        elevationZ: startPointZ,
        boostBar: op.effectiveBoostBar,
        mode: sourceMode === 'suction' ? 'vascone_suction' : 'direct',
        suctionLiftM: sourceMode === 'suction' ? suctionLiftM : 0
      });
    }

    fieldNodes
      .filter(n => n.type === 'pump')
      .forEach(n => {
        const cfg = n.pumpConfig;
        const type = findPumpType(cfg?.pumpTypeId ?? 'pump-8-8', config.pumpTypes);
        const op = calculatePumpDeliveryPressure(type, flowLpm, cfg?.regulatedBoostBar);
        list.push({
          distanceM: n.distanceM,
          elevationZ: n.elevationZ,
          boostBar: op.effectiveBoostBar,
          mode: cfg?.mode ?? 'direct',
          suctionLiftM: cfg?.suctionLiftM ?? 0
        });
      });

    return list.sort((a, b) => a.distanceM - b.distanceM);
  }, [pumpAtStart, pumpTypeId, sourceMode, suctionLiftM, startPointZ, fieldNodes, flowLpm, config.pumpTypes]);

  /**
   * Stima la pressione residua [bar] alla posizione corrente con la stessa
   * logica del motore idraulico (sorgente -> pompe in sequenza -> tratto finale).
   */
  const estimateResidualBar = useCallback(
    (pointZ: number, pointDistM: number): number => {
      let headM =
        sourceMode === 'suction'
          ? startPointZ
          : startPointZ + sourcePressureBar * BAR_TO_METERS;

      let prevDist = 0;
      for (const p of livePumps) {
        headM -= unitLoss * Math.max(0, p.distanceM - prevDist) * lossFactor;
        if (p.mode === 'vascone_suction') {
          headM = p.elevationZ - p.suctionLiftM + p.boostBar * BAR_TO_METERS;
        } else {
          headM = headM + p.boostBar * BAR_TO_METERS;
        }
        prevDist = p.distanceM;
      }
      headM -= unitLoss * Math.max(0, pointDistM - prevDist) * lossFactor;

      return (headM - pointZ) * METERS_TO_BAR;
    },
    [sourceMode, startPointZ, sourcePressureBar, livePumps, unitLoss, lossFactor]
  );

  const currentEstimatedPressureBar = Math.max(-2, estimateResidualBar(currentZ, liveDistanceDiagM));
  const isLowPressureAlert = currentEstimatedPressureBar <= 1.5 && isRecording && liveDistanceDiagM > 40;

  // Allarme acustico con Web Audio API
  useEffect(() => {
    if (isLowPressureAlert && soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota La
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
        // Ignora limitazioni autoplay audio
      }
    }
  }, [isLowPressureAlert, soundEnabled]);

  // --- Registrazione: punto a mano -----------------------------------------
  const doRecordPoint = useCallback((manual: boolean): GPSPoint | null => {
    const tracker = trackerRef.current;
    if (!tracker.getLastFix()) {
      setRecordHint('In attesa di un fix GPS valido…');
      return null;
    }

    const point = tracker.recordCurrentPoint(manual ? 0 : MIN_MOVE_M);
    setRecordedPoints([...tracker.getRecordedPoints()]);

    if (!point) {
      setRecordHint(`Posizione invariata (meno di ${MIN_MOVE_M} m): nessun punto aggiunto.`);
      return null;
    }

    setRecordHint(
      `Punto ${tracker.getRecordedPoints().length} registrato a ${point.cumulativeDiagM.toFixed(1)} m (Z = ${point.altitudeM.toFixed(1)} m).`
    );
    return point;
  }, []);

  // --- Registrazione a intervallo ------------------------------------------
  useEffect(() => {
    if (!isRecording || isPaused || intervalSec <= 0) return;
    const id = window.setInterval(() => {
      doRecordPoint(false);
    }, intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [isRecording, isPaused, intervalSec, doRecordPoint]);

  // --- Attiva / spegni GPS --------------------------------------------------
  const handleToggleGps = () => {
    if (gpsActive) {
      trackerRef.current.stopWatch();
      setGpsActive(false);
      setIsRecording(false);
      setIsPaused(false);
      setCurrentPoint(null);
      setRecordHint(null);
      return;
    }

    setGpsError(null);
    const ok = trackerRef.current.startWatch(
      (fix) => setCurrentPoint(fix),
      (err) => {
        setGpsError(`Errore GPS (codice ${err.code}): ${err.message}`);
        if (err.code === 1) {
          // Permesso negato: il GPS non è davvero acceso.
          trackerRef.current.stopWatch();
          setGpsActive(false);
          setIsRecording(false);
          setIsPaused(false);
          setCurrentPoint(null);
        }
      }
    );
    if (ok) setGpsActive(true);
  };

  // --- Avvia / pausa / termina registrazione -------------------------------
  const handleStartRecording = () => {
    if (!gpsActive) {
      setGpsError('Attiva prima il GPS con il pulsante "Attiva GPS".');
      return;
    }
    if (!trackerRef.current.getLastFix()) {
      setGpsError('In attesa del primo fix GPS: attendi qualche secondo e riprova.');
      return;
    }

    setGpsError(null);
    setIsRecording(true);
    setIsPaused(false);

    // Il punto di partenza è subito il primo punto del tracciato.
    const first =
      recordedPoints.length === 0
        ? trackerRef.current.recordCurrentPoint(0)
        : null;
    if (first) {
      setRecordedPoints([...trackerRef.current.getRecordedPoints()]);
      setRecordHint('Punto di partenza registrato.');
    }
  };

  const handleTogglePause = () => setIsPaused(p => !p);

  const handleStopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
  };

  const handleUndoLastPoint = () => {
    const removed = trackerRef.current.removeLastPoint();
    setRecordedPoints([...trackerRef.current.getRecordedPoints()]);
    setRecordHint(removed ? 'Ultimo punto annullato.' : 'Nessun punto da annullare.');
  };

  // --- Marcatura elementi sul posto ----------------------------------------
  const handleAddMarker = (type: 'pump' | 'end') => {
    if (!currentPoint) {
      setGpsError('In attesa di coordinate GPS valide: la marcatura sarà possibile tra qualche istante.');
      return;
    }
    setGpsError(null);

    const newNode: StationNode = {
      id: `field-${type}-${Date.now()}`,
      distanceM: Math.round(liveDistanceDiagM),
      elevationZ: Math.round(currentPoint.altitudeM),
      type,
      pumpConfig:
        type === 'pump'
          ? { pumpTypeId: markerPumpTypeId, mode: 'direct' }
          : undefined,
      notes:
        type === 'pump'
          ? `${shortPumpName(selectedMarkerPump.name)} rilevata sul campo (Accuratezza ±${currentPoint.accuracyM.toFixed(0)}m)`
          : `Rilevato sul campo GPS (Accuratezza ±${currentPoint.accuracyM.toFixed(0)}m)`,
      latitude: currentPoint.latitude,
      longitude: currentPoint.longitude
    };

    setFieldNodes(prev => [...prev, newNode]);
  };

  /** Cambia il modello di una motopompa già marcata sul tracciato. */
  const handleMarkerPumpType = (id: string, pumpTypeIdValue: string) => {
    setFieldNodes(prev =>
      prev.map(n =>
        n.id === id
          ? {
              ...n,
              pumpConfig: {
                ...(n.pumpConfig ?? { mode: 'direct' as const }),
                pumpTypeId: pumpTypeIdValue
              }
            }
          : n
      )
    );
  };

  /** Rimuove un elemento marcato per errore. */
  const handleRemoveMarker = (id: string) => {
    setFieldNodes(prev => prev.filter(n => n.id !== id));
  };

  // --- Percorso GPS a piena risoluzione (con coordinate) --------------------
  const track = useMemo<GpsTrackPoint[]>(
    () =>
      recordedPoints
        .filter(pt => Number.isFinite(pt.latitude) && Number.isFinite(pt.longitude))
        .map(pt => ({
          distanceM: pt.cumulativeDiagM,
          elevationZ: pt.altitudeM,
          latitude: pt.latitude,
          longitude: pt.longitude
        })),
    [recordedPoints]
  );

  const mapMarkers = useMemo<RouteMapMarker[]>(
    () =>
      fieldNodes
        .filter(n => n.type === 'pump')
        .map(n => ({
          distanceM: n.distanceM,
          kind: 'pump' as const,
          label: 'Motopompa'
        })),
    [fieldNodes]
  );

  // --- Trasferimento nel progetto ------------------------------------------
  const handleApplyToProject = () => {
    if (recordedPoints.length < 2 && fieldNodes.length < 2) {
      setGpsError('Registra almeno due punti per generare la condotta.');
      return;
    }

    const finalNodes = buildTrackNodes({
      recordedPoints,
      fieldNodes,
      pumpAtStart,
      startPumpTypeId: pumpTypeId,
      sourceMode,
      sourcePressureBar,
      suctionLiftM
    });

    // Difesa: mai passare una traccia vuota, che svuoterebbe il progetto aperto.
    if (finalNodes.length < 2) {
      setGpsError('Registra almeno due punti del tracciato per generare la condotta.');
      return;
    }
    setGpsError(null);

    onApplyGpsTrack({
      nodes: finalNodes,
      targetFlowLpm: flowLpm,
      sourcePressureBar: sourceMode === 'pressure' ? sourcePressureBar : undefined,
      track
    });
    onExit();
  };

  // --- Stato precisione -----------------------------------------------------
  const accuracyM = currentPoint?.accuracyM ?? null;
  const accuracyQuality =
    accuracyM === null
      ? null
      : accuracyM <= 10
      ? { label: 'Ottima', cls: 'bg-emerald-950 text-emerald-400 border-emerald-800' }
      : accuracyM <= 25
      ? { label: 'Buona', cls: 'bg-sky-950 text-sky-400 border-sky-800' }
      : { label: 'Scarsa', cls: 'bg-amber-950 text-amber-400 border-amber-800' };

  const pointsPerMinute = intervalSec > 0 ? Math.round(60 / intervalSec) : null;
  const canStart = gpsActive && currentPoint !== null && !isRecording;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl ${isRecording ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : gpsActive ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>Modalità Live GPS sul Campo</span>
              {isRecording && (
                <span className={`text-[10px] ${isPaused ? 'bg-amber-600' : 'bg-red-600 animate-pulse'} text-white font-mono px-2 py-0.5 rounded-full uppercase tracking-wider`}>
                  {isPaused ? 'IN PAUSA' : 'REC IN DIRETTA'}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Percorri a piedi la tratta srotolando le manichette: l'app calcola la piezometrica in tempo reale e ti avvisa dove piazzare la motopompa.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {gpsActive && accuracyM !== null && (
            <span className={`text-[10px] font-mono px-2 py-1 rounded-lg border ${accuracyQuality?.cls ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              GPS ±{accuracyM.toFixed(0)} m {accuracyQuality ? `· ${accuracyQuality.label}` : ''}
            </span>
          )}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs transition cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
            title="Attiva/Disattiva allarmi acustici"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {gpsError && (
        <div className="bg-red-950/60 border border-red-700 text-red-200 p-3 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Preparazione: GPS -> sorgente -> pompa -> portata -> registrazione */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
        {/* 1. Attiva GPS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${gpsActive ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">1 · Attiva GPS</h3>
              <p className="text-[11px] text-slate-400 max-w-md">
                Accendi il GPS qualche decina di secondi prima di partire: i satelliti si agganciano e l'errore di
                posizionamento scende. Il tracciato non registra nulla finché non avvii la registrazione.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleGps}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-lg shrink-0 ${
              gpsActive
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>{gpsActive ? 'Spegni GPS' : 'Attiva GPS'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 border-t border-slate-800 pt-3">
          {!gpsActive ? (
            <span>GPS spento.</span>
          ) : currentPoint ? (
            <>
              <span className="text-emerald-400 font-semibold">GPS attivo</span>
              <span>Errore: ±{currentPoint.accuracyM.toFixed(0)} m {accuracyQuality ? `(${accuracyQuality.label})` : ''}</span>
              <span>Quota: {currentPoint.altitudeM.toFixed(1)} m s.l.m.</span>
              <span className="font-mono">{currentPoint.latitude.toFixed(5)}, {currentPoint.longitude.toFixed(5)}</span>
            </>
          ) : (
            <span className="text-amber-400">Ricerca satelliti… attendi il primo fix.</span>
          )}
        </div>

        {/* 2. Sorgente al punto di partenza */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center space-x-2 mb-3">
            <MapPin className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-slate-100">2 · Punto di partenza (sorgente)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setSourceMode('pressure')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                sourceMode === 'pressure'
                  ? 'bg-sky-950/60 border-sky-600 text-sky-100'
                  : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold text-xs">
                <Gauge className="w-4 h-4" />
                <span>Pressione in mandata</span>
              </div>
              <p className="text-[11px] mt-1 opacity-80">Autobotte o idrante in pressione: imposta i bar disponibili alla partenza.</p>
            </button>

            <button
              onClick={() => {
                setSourceMode('suction');
                setPumpAtStart(true);
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                sourceMode === 'suction'
                  ? 'bg-cyan-950/60 border-cyan-600 text-cyan-100'
                  : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold text-xs">
                <Waves className="w-4 h-4" />
                <span>Aspirazione da pelo libero</span>
              </div>
              <p className="text-[11px] mt-1 opacity-80">Vascone, fiume o piscina: imposta l'altezza di aspirazione (richiede una motopompa).</p>
            </button>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-xs text-slate-300 font-semibold">
              {sourceMode === 'pressure' ? 'Pressione alla partenza' : 'Altezza di aspirazione'}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min={0}
                max={sourceMode === 'pressure' ? 20 : 6}
                step={sourceMode === 'pressure' ? 0.5 : 0.5}
                value={sourceMode === 'pressure' ? sourcePressureBar : suctionLiftM}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (Number.isNaN(v)) return;
                  if (sourceMode === 'pressure') setSourcePressureBar(v);
                  else setSuctionLiftM(v);
                }}
                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-sky-500"
              />
              <span className="text-xs text-slate-400 font-mono w-10">
                {sourceMode === 'pressure' ? 'bar' : 'm'}
              </span>
            </div>
            {sourceMode === 'suction' && suctionLiftM > 6 && (
              <span className="text-[11px] text-red-400 font-semibold">
                Oltre 6 m l'aspirazione non è possibile (cavitazione).
              </span>
            )}
          </div>
        </div>

        {/* 3. Motopompa: modello + pompa alla partenza */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center space-x-2 mb-3">
            <Flame className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-bold text-slate-100">3 · Motopompa di partenza</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Modello della motopompa di partenza
              </label>
              <select
                value={pumpTypeId}
                onChange={e => setPumpTypeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-yellow-500 cursor-pointer"
              >
                {pumpCatalogue.length === 0 && (
                  <option value={pumpTypeId}>Catalogo vuoto — gestisci pompe</option>
                )}
                <PumpOptions pumpTypes={config.pumpTypes} />
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {shortPumpName(selectedPump.name)} · {selectedPump.nominalFlowLpm} l/min @{' '}
                {selectedPump.nominalHeadBar} bar. Le motopompe marcate sul campo hanno un modello
                proprio, scelto nelle "Azioni Rapide sul Posto".
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <label className={`flex items-start space-x-2 text-xs font-semibold ${sourceMode === 'suction' ? 'text-slate-500' : 'text-slate-200'}`}>
                <input
                  type="checkbox"
                  checked={pumpAtStart}
                  disabled={sourceMode === 'suction'}
                  onChange={e => setPumpAtStart(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-yellow-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <span>Piazza subito una motopompa al punto di partenza</span>
              </label>
              {sourceMode === 'suction' && (
                <p className="text-[11px] text-cyan-300 mt-2 ml-6">
                  L'aspirazione da pelo libero richiede una motopompa alla partenza: l'opzione è
                  attivata automaticamente.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 4. Portata */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center space-x-2 mb-3">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">4 · Portata di lavoro</h3>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={flowLpm}
              onChange={e => setFlowLpm(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {FLOW_OPTIONS.map(q => (
                <option key={q} value={q}>{q} l/min</option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400">
              Usata per la stima in tempo reale e trasferita al progetto.
            </span>
          </div>
        </div>

        {/* 5. Registrazione punti */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-slate-100">5 · Registrazione punti</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {INTERVAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setIntervalSec(opt.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  intervalSec === opt.value
                    ? 'bg-sky-600 border-sky-500 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            {intervalSec > 0
              ? `Un punto automatico ogni ${intervalSec} s: circa ${pointsPerMinute} punti al minuto (a passo d'uomo la distanza tra i punti è di alcuni metri).`
              : 'Nessun punto automatico: batti i punti a mano quando serve.'}
            {' '}Prima l'app salvava un punto ogni ~2 m percorsi (circa 20-30 al minuto): ora decidi tu.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                disabled={!canStart}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg ${
                  canStart
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title={
                  !gpsActive
                    ? 'Prima attiva il GPS'
                    : !currentPoint
                    ? 'In attesa del primo fix GPS'
                    : 'Avvia la registrazione del tracciato'
                }
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Avvia Tracciamento GPS</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleTogglePause}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-lg ${
                    isPaused
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                  <span>{isPaused ? 'Riprendi' : 'Pausa'}</span>
                </button>

                <button
                  onClick={handleStopRecording}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-lg bg-red-600 hover:bg-red-500 text-white"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Termina</span>
                </button>
              </>
            )}

            <button
              onClick={() => doRecordPoint(true)}
              disabled={currentPoint === null}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg ${
                currentPoint !== null
                  ? 'bg-sky-700 hover:bg-sky-600 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title={
                currentPoint !== null
                  ? 'Salva la posizione attuale come punto del tracciato'
                  : 'In attesa del primo fix GPS'
              }
            >
              <Hand className="w-4 h-4" />
              <span>Batti Punto a Mano</span>
            </button>

            {recordedPoints.length > 0 && (
              <button
                onClick={handleUndoLastPoint}
                className="px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Annulla l'ultimo punto registrato"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Annulla ultimo</span>
              </button>
            )}
          </div>

          {recordHint && (
            <p className="text-[11px] text-slate-300 mt-2 font-mono">{recordHint}</p>
          )}

          {recordedPoints.length > 0 && (
            <div className="mt-3">
              <span className="text-[11px] font-semibold text-slate-300">
                Punti registrati: {recordedPoints.length}
              </span>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 divide-y divide-slate-800">
                {recordedPoints.map((pt, idx) => (
                  <div key={`${pt.timestamp}-${idx}`} className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-slate-300">
                    <span className="text-slate-500">#{idx + 1}</span>
                    <span>{pt.cumulativeDiagM.toFixed(0)} m <span className="text-slate-500">(plan. {pt.cumulativeDistM.toFixed(0)} m)</span></span>
                    <span className="text-sky-300">Z {pt.altitudeM.toFixed(1)} m</span>
                    <span className="text-slate-500">±{pt.accuracyM.toFixed(0)} m</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Big Instruments Display (Sunlight readable) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tachimetro Pressione Residua */}
        <div className={`rounded-2xl p-5 border flex flex-col justify-between shadow-xl ${
          currentEstimatedPressureBar <= 1.0
            ? 'bg-red-950/80 border-red-500 text-red-100'
            : currentEstimatedPressureBar <= 2.0
            ? 'bg-amber-950/80 border-amber-500 text-amber-100'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider opacity-75">
              Pressione Residua Stimata
            </span>
            <span className="text-xs font-mono font-bold">
              Q: {flowLpm} l/min
            </span>
          </div>

          <div className="my-4 text-center">
            <div className={`text-5xl font-black font-mono tracking-tight ${
              currentEstimatedPressureBar <= 1.0
                ? 'text-red-400'
                : currentEstimatedPressureBar <= 2.0
                ? 'text-amber-400'
                : 'text-sky-300'
            }`}>
              {currentPoint ? currentEstimatedPressureBar.toFixed(2) : '--'}
            </div>
            <div className="text-sm font-semibold opacity-80 uppercase mt-1">
              bar residui
            </div>
          </div>

          <div>
            {isLowPressureAlert ? (
              <div className="bg-red-600 text-white font-bold p-2 rounded-lg text-xs text-center animate-bounce">
                ⚠️ FERMATI QUI: PIAZZA MOTOPOMPA!
              </div>
            ) : (
              <div className="text-[11px] text-center opacity-75">
                Soglia minima di sicurezza: 1.5 bar
              </div>
            )}
          </div>
        </div>

        {/* Distanza & Sviluppo Condotta */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Sviluppo Condotta Percorso
            </span>
            <span className="text-xs font-mono text-slate-400">
              Rotoli: {Math.ceil(liveDistanceDiagM / (config.hoseSectionLengthM || 20))}
            </span>
          </div>

          <div className="my-4 text-center">
            <div className="text-5xl font-black font-mono tracking-tight text-emerald-400">
              {currentPoint ? liveDistanceDiagM.toFixed(0) : '0'}
            </div>
            <div className="text-sm font-semibold text-slate-300 uppercase mt-1">
              metri diagonali
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>Planimetrica: {liveDistancePlanM.toFixed(0)} m</span>
            <span>Punti registrati: {recordedPoints.length}</span>
          </div>
        </div>

        {/* Quota GPS & Precisione */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Altimetria GPS
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              accuracyQuality?.cls ?? 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              Precisione ±{currentPoint?.accuracyM.toFixed(0) ?? '--'} m
            </span>
          </div>

          <div className="my-4 text-center">
            <div className="text-5xl font-black font-mono tracking-tight text-sky-400">
              {currentPoint ? currentPoint.altitudeM.toFixed(1) : '--'}
            </div>
            <div className="text-sm font-semibold text-slate-300 uppercase mt-1">
              metri s.l.m.
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>Dislivello parziale: {deltaZ >= 0 ? `+${deltaZ.toFixed(1)}` : deltaZ.toFixed(1)} m</span>
            <span>Lat/Lon: {currentPoint ? `${currentPoint.latitude.toFixed(4)}, ${currentPoint.longitude.toFixed(4)}` : '--'}</span>
          </div>
        </div>
      </div>

      {/* Field Action Buttons (Big buttons for gloved hands) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Azioni Rapide sul Posto (Marcatura Elementi)
        </h3>

        {/* Modello delle motopompe piazzate sul campo: indipendente da quella di partenza. */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Motopompa da piazzare sul campo (può essere diversa da quella di partenza)
          </label>
          <select
            value={markerPumpTypeId}
            onChange={e => setMarkerPumpTypeId(e.target.value)}
            className="w-full sm:max-w-md bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-yellow-500 cursor-pointer"
          >
            {pumpCatalogue.length === 0 && (
              <option value={markerPumpTypeId}>Catalogo vuoto — gestisci pompe</option>
            )}
            <PumpOptions pumpTypes={config.pumpTypes} />
          </select>
          {markerPumpTypeId === pumpTypeId && pumpAtStart && (
            <p className="text-[11px] text-amber-300/80 mt-1">
              Stesso modello della motopompa di partenza: nessun problema, scegline un altro se
              serve un rilancio più potente.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleAddMarker('pump')}
            className="p-3 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-500/40 rounded-xl font-bold text-xs flex flex-col items-center justify-center space-y-1 transition cursor-pointer"
            title={`Piazza qui: ${selectedMarkerPump.name}`}
          >
            <span className="flex items-center space-x-2">
              <Flame className="w-5 h-5 text-yellow-400" />
              <span>Piazza Motopompa Qui</span>
            </span>
            <span className="text-[10px] font-mono font-normal text-yellow-200/80">
              {shortPumpName(selectedMarkerPump.name)} · {selectedMarkerPump.nominalFlowLpm} l/min @{' '}
              {selectedMarkerPump.nominalHeadBar} bar
            </span>
          </button>

          <button
            onClick={() => handleAddMarker('end')}
            className="p-3 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <CheckCircle className="w-5 h-5 text-red-400" />
            <span>Fine Condotta / Lancia</span>
          </button>
        </div>

        {/* Recorded elements list */}
        {fieldNodes.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Elementi Marcati sul Tracciato ({fieldNodes.length}):
            </span>
            <div className="flex flex-col gap-2">
              {fieldNodes.map((fn, idx) => (
                <div
                  key={fn.id}
                  className="px-2.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex flex-wrap items-center gap-2"
                >
                  <span className="text-slate-400 font-sans">{idx + 1}.</span>
                  <span className="font-semibold text-sky-400 uppercase">{fn.type}</span>
                  {fn.type === 'pump' && (
                    <select
                      value={fn.pumpConfig?.pumpTypeId ?? 'pump-8-8'}
                      onChange={e => handleMarkerPumpType(fn.id, e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-amber-300 focus:outline-none focus:border-yellow-500 cursor-pointer max-w-[240px] truncate"
                      aria-label={`Modello della motopompa marcata al punto ${idx + 1}`}
                      title="Cambia il modello di questa motopompa"
                    >
                      <PumpOptions pumpTypes={config.pumpTypes} />
                    </select>
                  )}
                  <span className="text-slate-400">
                    a {fn.distanceM.toFixed(0)}m (Z={fn.elevationZ.toFixed(0)}m)
                  </span>
                  <button
                    onClick={() => handleRemoveMarker(fn.id)}
                    className="ml-auto p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded transition cursor-pointer"
                    title="Rimuovi questo elemento"
                    aria-label={`Rimuovi l'elemento marcato al punto ${idx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vedi mappa: percorso rilevato con latitudine e longitudine */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-300 block">
                Vedi mappa del percorso
              </span>
              <span className="text-[11px] text-slate-500">
                {track.length >= 2
                  ? `${track.length} punti GPS con coordinate, pronti per la vista planimetrica e l'export GPX.`
                  : 'La mappa si popola man mano che registri i punti con coordinate GPS.'}
              </span>
            </div>
            <button
              onClick={() => setShowMap(v => !v)}
              disabled={track.length < 2}
              className={`shrink-0 inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold transition ${
                track.length >= 2
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
                  : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
            >
              <MapPin className="w-4 h-4 mr-1.5" />
              {showMap ? 'Nascondi mappa' : 'Vedi mappa'}
            </button>
          </div>

          {showMap && track.length >= 2 && (
            <div className="mt-3">
              <RouteMap
                points={track}
                markers={mapMarkers}
                title={`Percorso GPS ${new Date().toLocaleDateString('it-IT')}`}
              />
            </div>
          )}
        </div>

        {/* Transfer Button */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleApplyToProject}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer shadow-lg"
          >
            <span>Genera Profilo e Linea Piezometrica</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
