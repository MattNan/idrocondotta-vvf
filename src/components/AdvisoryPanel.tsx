import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lightbulb,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  TrendingDown,
  Layers,
  Gauge,
  Plus,
  Info
} from 'lucide-react';
import { CalculationResult, StationNode, ProjectConfig } from '../types';

interface AdvisoryPanelProps {
  result: CalculationResult;
  config: ProjectConfig;
  onAddPumpAtStation?: (stationM: number, pumpTypeId: string) => void;
  onHighlightStation?: (stationM: number) => void;
}

export const AdvisoryPanel: React.FC<AdvisoryPanelProps> = ({
  result,
  config,
  onAddPumpAtStation,
  onHighlightStation
}) => {
  const { summary, alerts, advisories } = result;

  /** Motopompe che pescano a pelo libero (vasca, fiume, piscina). */
  const suctionPumps = result.points.filter(p => p.freeSurfaceM !== undefined).length;

  return (
    <div className="space-y-4">
      {/* 1. Main Feasibility Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg ${
          summary.isFeasible
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
            : 'bg-red-950/50 border-red-500/60 text-red-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-xl ${
              summary.isFeasible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {summary.isFeasible ? (
              <ShieldCheck className="w-7 h-7" />
            ) : (
              <ShieldAlert className="w-7 h-7" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold tracking-wide">
                {summary.isFeasible
                  ? 'CONDOTTA IDRAULICAMENTE FATTIBILE'
                  : 'CONDOTTA NON FATTIBILE - RILEVATE CRITICITÀ'}
              </h2>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                  summary.isFeasible
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {summary.isFeasible ? 'VERIFICATO' : 'ATTENZIONE'}
              </span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {summary.isFeasible
                ? `La pressione al terminale (${summary.endPressureBar.toFixed(2)} bar) soddisfa la richiesta (≥ ${config.requiredEndPressureBar} bar) senza superare i limiti delle manichette.`
                : 'Sono presenti tratti in depressione, rischio scoppio o pressione insufficiente al terminale. Esamina gli allarmi e i consigli sotto.'}
            </p>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="flex items-center space-x-4 text-xs font-mono border-t md:border-t-0 md:border-l border-current/20 pt-2 md:pt-0 md:pl-4">
          <div>
            <span className="block opacity-75">Pressione Lancia:</span>
            <span className={`text-base font-bold ${
              summary.endPressureBar >= config.requiredEndPressureBar
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}>
              {summary.endPressureBar.toFixed(2)} bar
            </span>
          </div>
          <div>
            <span className="block opacity-75">Rotoli Manichette:</span>
            <span className="text-base font-bold text-slate-100">
              {summary.hosesCount} x {config.hoseSectionLengthM}m
            </span>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Lunghezza Reale */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center">
            <Layers className="w-3.5 h-3.5 mr-1 text-sky-400" /> Distanza Reale Condotta
          </span>
          <div className="text-base font-bold font-mono text-slate-100 mt-1">
            {summary.totalDistanceM.toFixed(0)} m
          </div>
          <span className="text-[10px] text-slate-500">
            Sviluppo reale (incl. pendenze)
          </span>
        </div>

        {/* Dislivello */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center">
            <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Dislivello ΔZ
          </span>
          <div className="text-base font-bold font-mono text-emerald-400 mt-1">
            {summary.elevationDeltaM >= 0 ? `+${summary.elevationDeltaM.toFixed(1)}` : summary.elevationDeltaM.toFixed(1)} m
          </div>
          <span className="text-[10px] text-slate-500">
            Da {summary.startElevationM.toFixed(0)}m a {summary.endElevationM.toFixed(0)}m
          </span>
        </div>

        {/* Pressione Max Raggiunta */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center">
            <Gauge className="w-3.5 h-3.5 mr-1 text-red-400" /> Pressione Max
          </span>
          <div className={`text-base font-bold font-mono mt-1 ${
            summary.maxPressureBar > config.maxLinePressureBar ? 'text-red-400' : 'text-slate-100'
          }`}>
            {summary.maxPressureBar.toFixed(2)} bar
          </div>
          <span className="text-[10px] text-slate-500">
            Limite: {config.maxLinePressureBar} bar
          </span>
        </div>

        {/* Pressione Minima Raggiunta */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center">
            <TrendingDown className="w-3.5 h-3.5 mr-1 text-amber-400" /> Pressione Min
          </span>
          <div className={`text-base font-bold font-mono mt-1 ${
            summary.minPressureBar < 0 ? 'text-red-400' : summary.minPressureBar < config.minLinePressureBar ? 'text-amber-400' : 'text-slate-100'
          }`}>
            {summary.minPressureBar.toFixed(2)} bar
          </div>
          <span className="text-[10px] text-slate-500">
            Soglia min: {config.minLinePressureBar} bar
          </span>
        </div>

        {/* Motopompe Attive */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center">
            <Flame className="w-3.5 h-3.5 mr-1 text-yellow-400" /> Motopompe
          </span>
          <div className="text-base font-bold font-mono text-yellow-400 mt-1">
            {summary.pumpsCount} installate
          </div>
          <span className="text-[10px] text-slate-500">
            In linea o in aspirazione
          </span>
        </div>

        {/* Peli liberi di aspirazione */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center">
            <Info className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Peli liberi
          </span>
          <div className="text-base font-bold font-mono text-cyan-400 mt-1">
            {suctionPumps} in aspirazione
          </div>
          <span className="text-[10px] text-slate-500">
            P = 0 bar sul pelo libero
          </span>
        </div>
      </div>

      {/* 3. Consigli Intelligenti di Posa (Smart Advisory) */}
      {advisories.length > 0 && (
        <div className="bg-sky-950/30 border border-sky-800/60 rounded-xl p-4 shadow-md">
          <div className="flex items-center space-x-2 mb-3">
            <Lightbulb className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-sky-200 uppercase tracking-wider">
              Consigli Operativi di Posa ({advisories.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {advisories.map((adv) => (
              <div
                key={adv.id}
                className="bg-slate-900/80 border border-sky-700/40 rounded-xl p-3 flex flex-col justify-between text-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sky-300">{adv.title}</span>
                    <button
                      onClick={() => onHighlightStation && onHighlightStation(adv.stationM)}
                      className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                    >
                      Evidenzia a {adv.stationM.toFixed(0)}m
                    </button>
                  </div>
                  <p className="text-slate-300 mt-1">{adv.description}</p>
                  <p className="text-slate-400 italic mt-1">{adv.actionHint}</p>
                </div>

                {onAddPumpAtStation && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Azione rapida:</span>
                    <div className="flex space-x-1.5">
                      <button
                        onClick={() => onAddPumpAtStation(adv.stationM, 'pump-8-8')}
                        className="px-2.5 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded text-[11px] font-medium transition cursor-pointer flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" /> + Pompa 8/8
                      </button>
                      <button
                        onClick={() => onAddPumpAtStation(adv.stationM, 'pump-12-10')}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-medium transition cursor-pointer flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" /> + Pompa 12/10
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Allarmi di Sicurezza e Criticità */}
      {alerts.length > 0 && (
        <div className="bg-red-950/25 border border-red-800/60 rounded-xl p-4 shadow-md">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-red-200 uppercase tracking-wider">
              Registro Allarmi di Sicurezza e Anomalie ({alerts.length})
            </h3>
          </div>

          <div className="space-y-2">
            {alerts.map((al) => (
              <div
                key={al.id}
                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between ${
                  al.type === 'danger'
                    ? 'bg-red-900/30 border-red-700/60 text-red-200'
                    : 'bg-amber-900/30 border-amber-700/60 text-amber-200'
                }`}
              >
                <div>
                  <div className="font-semibold flex items-center space-x-2">
                    <span>{al.title}</span>
                    <span className="text-[10px] font-mono opacity-80">
                      (Progressiva {al.stationM.toFixed(0)} m)
                    </span>
                  </div>
                  <p className="mt-0.5 opacity-90">{al.message}</p>
                </div>

                {onHighlightStation && (
                  <button
                    onClick={() => onHighlightStation(al.stationM)}
                    className="text-[10px] underline ml-3 shrink-0 cursor-pointer"
                  >
                    Vedi nel grafico
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
