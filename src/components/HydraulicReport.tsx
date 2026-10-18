import React from 'react';
import { Printer, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import {
  ProjectConfig,
  CalculationResult,
  CalculatedPoint,
  GpsTrackPoint
} from '../types';
import { HydraulicChart } from './HydraulicChart';
import { findPumpType } from '../engine/pumpCatalogue';
import { calculateHoseStretches, countHoses } from '../engine/hoseCount';

interface HydraulicReportProps {
  config: ProjectConfig;
  result: CalculationResult;
  /** Percorso GPS a piena risoluzione, se il progetto arriva dal campo. */
  track?: GpsTrackPoint[];
  /** Nome dello scenario o della condotta in esame. */
  scenarioLabel: string;
  onBack: () => void;
}

const fmt = (v: number | undefined, decimals = 2): string =>
  v !== undefined && Number.isFinite(v) ? v.toFixed(decimals) : '--';

const Kpi: React.FC<{ label: string; value: string; unit?: string; tone?: string }> = ({
  label,
  value,
  unit,
  tone
}) => (
  <div className="border border-slate-300 rounded-lg px-3 py-2">
    <span className="block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    <span className={`font-mono text-sm font-bold ${tone ?? 'text-slate-900'}`}>
      {value}
      {unit && <span className="text-[10px] font-sans font-normal text-slate-500 ml-1">{unit}</span>}
    </span>
  </div>
);

/**
 * "Report Condotta": documento riepilogativo stampabile (o salvabile in PDF
 * con la stampa del browser). Raccoglie il profilo altimetrico, lo schema
 * delle macchine con le pressioni e il computo degli spezzoni di manichetta.
 */
export const HydraulicReport: React.FC<HydraulicReportProps> = ({
  config,
  result,
  track,
  scenarioLabel,
  onBack
}) => {
  const { points, summary, alerts } = result;

  const machinePoints = points.filter(p => p.node.type === 'pump');

  // ---- Computo spezzoni per tratto ---------------------------------------
  // I tratti vanno da una macchina alla successiva (partenza, motopompa, pelo
  // libero, arrivo) o da un cambio di diametro: è la stessa funzione usata dal
  // motore, quindi il totale qui stampato non può discostarsi dal calcolo.
  const sections = calculateHoseStretches(points, config);

  const totalHoses = countHoses(sections);

  /** Che cosa c'è ai due capi del tratto, per l'etichetta della tabella. */
  const boundaryLabel = (point: CalculatedPoint): string => {
    switch (point.node.type) {
      case 'pump': {
        const pump = findPumpType(point.node.pumpConfig?.pumpTypeId || '', config.pumpTypes);
        const short = pump.name.split('(')[0].trim();
        return point.node.pumpConfig?.mode === 'vascone_suction' ? `${short} in aspirazione` : short;
      }
      case 'end':
        return 'Arrivo';
      case 'start':
        return 'Partenza';
      default:
        return 'Cambio diametro';
    }
  };
  const generatedAt = new Date().toLocaleString('it-IT');

  const elevationDelta =
    points.length >= 2 ? points[points.length - 1].elevationZ - points[0].elevationZ : 0;

  const pumpModeLabel = (p: CalculatedPoint): string => {
    return p.node.pumpConfig?.mode === 'vascone_suction'
      ? `Aspirazione da pelo libero (H_asp ${fmt(p.node.pumpConfig?.suctionLiftM, 1)} m)`
      : 'In diretta in pressione';
  };

  const boostPercentLabel = (p: CalculatedPoint): string => {
    if (p.node.type !== 'pump') return '—';
    const max = p.node.pumpConfig?.maxAvailableBoostBar;
    const boost = p.pumpBoostBar;
    if (max === undefined || max <= 0 || boost === undefined) return '—';
    return `${((boost / max) * 100).toFixed(0)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Barra strumenti: non compare nella stampa */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Torna alla condotta
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg transition cursor-pointer"
        >
          <Printer className="w-4 h-4 mr-1.5" /> Stampa / Salva in PDF
        </button>
      </div>

      {/* Foglio del report: fondo bianco, leggibile anche su carta */}
      <div className="bg-white text-slate-900 rounded-xl shadow-2xl p-5 sm:p-8 space-y-6 print:shadow-none print:rounded-none print:p-0">
        {/* Intestazione */}
        <header className="border-b-2 border-slate-800 pb-4 flex flex-wrap items-start justify-between gap-3 print-avoid-break">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
              Report Condotta
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              IdroCondotta VVF — calcolo idraulico linea antincendio
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-2">
              Condotta: <span className="font-normal">{scenarioLabel || 'Progetto corrente'}</span>
            </p>
          </div>
          <div className="text-xs text-slate-600 text-right">
            <p>Generato il {generatedAt}</p>
            <p className="mt-0.5">
              Portata di progetto{' '}
              <span className="font-mono font-bold text-slate-900">{config.targetFlowLpm} l/min</span>
            </p>
            <p>
              Diametro di riferimento{' '}
              <span className="font-mono font-bold text-slate-900">{config.defaultDiameterMm} mm</span>
            </p>
          </div>
        </header>

        {/* Esito d'insieme */}
        <section className="print-avoid-break border-2 border-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            {summary.isFeasible ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-bold uppercase tracking-wide text-sm">
              {summary.isFeasible ? 'Condotta fattibile' : 'Condotta non fattibile'}
            </span>
            <span className="text-xs text-slate-600">
              Pressione alla lancia {fmt(summary.endPressureBar)} bar (richiesti{' '}
              {fmt(config.requiredEndPressureBar, 1)} bar)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi
              label="Sviluppo condotta"
              value={fmt(summary.totalDistanceM, 0)}
              unit="m"
            />
            <Kpi
              label="Dislivello"
              value={`${elevationDelta >= 0 ? '+' : ''}${fmt(elevationDelta, 0)}`}
              unit="m"
              tone={elevationDelta > 0 ? 'text-red-700' : 'text-emerald-700'}
            />
            <Kpi label="Macchine" value={`${summary.pumpsCount} motopompe`} />
            <Kpi
              label="Spezzoni totali"
              value={String(totalHoses)}
              unit={`da ${config.hoseSectionLengthM} m`}
            />
          </div>
        </section>

        {/* 1. Profilo altimetrico e linea piezometrica */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-slate-300 pb-1">
            1 · Profilo altimetrico e linea piezometrica
          </h2>
          <div className="h-[400px] w-full">
            <HydraulicChart result={result} config={config} variant="light" />
          </div>
        </section>

        {/* 2. Stazioni di rilancio e macchine */}
        <section className="space-y-2 print-avoid-break">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-slate-300 pb-1">
            2 · Stazioni di rilancio e macchine ({machinePoints.length})
          </h2>
          {machinePoints.length === 0 ? (
            <p className="text-xs text-slate-600">
              Nessuna macchina installata: la condotta è alimentata solo dalla pressione di sorgente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-300 px-2 py-1 font-semibold">N°</th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold">Prog. [m]</th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold">Quota Z [m]</th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold">Macchina</th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold">Modalità</th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold text-right">
                      ΔP [bar]
                    </th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold text-right">
                      ΔP / max
                    </th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold text-right">
                      P in [bar]
                    </th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold text-right">
                      P out [bar]
                    </th>
                    <th className="border border-slate-300 px-2 py-1 font-semibold">Esito</th>
                  </tr>
                </thead>
                <tbody>
                  {machinePoints.map((p, idx) => {
                    const pumpType = findPumpType(
                      p.node.pumpConfig?.pumpTypeId ?? 'pump-8-8',
                      config.pumpTypes
                    );
                    return (
                      <tr key={p.node.id} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                        <td className="border border-slate-300 px-2 py-1">{idx + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-mono">
                          {fmt(p.distanceM, 0)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-mono">
                          {fmt(p.elevationZ, 0)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {pumpType.name}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">{pumpModeLabel(p)}</td>
                        <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                          {fmt(p.pumpBoostBar)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                          {boostPercentLabel(p)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                          {p.node.pumpConfig?.mode === 'vascone_suction' ? 'asp.' : fmt(p.inletPressureBar)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                          {fmt(p.outletPressureBar)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {p.status === 'danger' ? (
                            <span className="text-red-700 font-semibold">Critico</span>
                          ) : p.status === 'warning' ? (
                            <span className="text-amber-700 font-semibold">Attenzione</span>
                          ) : (
                            <span className="text-emerald-700">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-slate-500">
            ΔP = prevalenza effettivamente erogata dalla motopompa alla portata di progetto;
            ΔP / max è la sua percentuale rispetto alla pressione massima disponibile dalla curva
            P-Q alla stessa portata. P in e P out sono le pressioni a monte e a valle della macchina.
          </p>
        </section>

        {/* 3. Spezzoni di manichetta per tratto */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-slate-300 pb-1">
            3 · Manichette fra due macchine (spezzoni da {config.hoseSectionLengthM} m)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="border border-slate-300 px-2 py-1 font-semibold">Tratto</th>
                  <th className="border border-slate-300 px-2 py-1 font-semibold text-right">
                    Lunghezza [m]
                  </th>
                  <th className="border border-slate-300 px-2 py-1 font-semibold text-right">
                    Diametro [mm]
                  </th>
                  <th className="border border-slate-300 px-2 py-1 font-semibold text-right">
                    N° manichette
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s, idx) => (
                  <tr key={s.key} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                    <td className="border border-slate-300 px-2 py-1 font-mono">
                      {fmt(s.fromM, 0)} → {fmt(s.toM, 0)} m
                      <span className="block font-sans text-[9px] text-slate-500">
                        {boundaryLabel(points[s.fromIndex])} → {boundaryLabel(points[s.toIndex])}
                      </span>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                      {fmt(s.lengthM, 0)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                      {s.diameterMm}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                      {s.hoses}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-200 font-bold">
                  <td className="border border-slate-300 px-2 py-1">Totale condotta</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                    {fmt(summary.totalDistanceM, 0)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right">—</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono text-right">
                    {totalHoses}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500">
            Un tratto va da una macchina alla successiva (partenza, motopompa, pelo libero di
            aspirazione, arrivo) o da un cambio di diametro; i vertici intermedi del profilo
            altimetrico non fanno tratto. Uno spezzone non si divide, quindi ogni tratto è
            arrotondato per eccesso e il totale è la somma dei tratti.
          </p>
        </section>

        {/* 4. Avvisi del calcolo */}
        {alerts.length > 0 && (
          <section className="space-y-2 print-avoid-break">
            <h2 className="text-sm font-bold uppercase tracking-wide border-b border-slate-300 pb-1">
              4 · Avvisi del calcolo ({alerts.length})
            </h2>
            <ul className="space-y-1">
              {alerts.map(a => (
                <li key={a.id} className="text-xs flex items-start gap-2">
                  <AlertTriangle
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      a.type === 'danger' ? 'text-red-600' : 'text-amber-600'
                    }`}
                  />
                  <span>
                    <span className="font-semibold">
                      {fmt(a.stationM, 0)} m — {a.title}:
                    </span>{' '}
                    <span className="text-slate-700">{a.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Parametri e note */}
        <section className="space-y-2 print-avoid-break">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-slate-300 pb-1">
            {alerts.length > 0 ? '5' : '4'} · Parametri di calcolo
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="P. sorgente" value={fmt(config.sourcePressureBar)} unit="bar" />
            <Kpi label="Max manichetta" value={fmt(config.maxLinePressureBar, 1)} unit="bar" />
            <Kpi label="Min linea" value={fmt(config.minLinePressureBar, 1)} unit="bar" />
            <Kpi
              label="P. richiesta lancia"
              value={fmt(config.requiredEndPressureBar, 1)}
              unit="bar"
            />
            <Kpi label="Perdite concentrate" value={`${fmt(config.localizedLossPercent, 0)}%`} />
            <Kpi label="Coefficiente C (H-W)" value={String(config.hazenWilliamsC)} />
            <Kpi
              label="Velocità flusso"
              value={fmt(result.flowVelocityMs, 2)}
              unit="m/s"
            />
          </div>
          {track && track.length > 0 && (
            <p className="text-[10px] text-slate-500">
              Tracciato GPS registrato sul campo: {track.length} punti con coordinate geografiche.
            </p>
          )}
          <p className="text-[10px] text-slate-500">
            Perdite di carico secondo Hazen-Williams (J = 10.67·Q^1.852 / (C^1.852 · D^4.87)) con
            coefficiente di maggiorazione per le perdite concentrate (curve e raccordi). Pressioni
            calcolate come P = (H − Z) · 0.0980665 bar.
          </p>
        </section>

        {/* Firme */}
        <footer className="pt-6 grid grid-cols-2 gap-8 text-xs text-slate-600 print-avoid-break">
          <div className="border-t border-slate-400 pt-1">Il capo partenza</div>
          <div className="border-t border-slate-400 pt-1">Note / annotazioni</div>
        </footer>
      </div>
    </div>
  );
};
