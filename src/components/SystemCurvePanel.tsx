import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, ChevronDown, AlertTriangle, CheckCircle2, Info, Waves, Flame } from 'lucide-react';
import { CalculationResult, ProjectConfig, SystemCurveSection } from '../types';
import { calculateSystemCurve } from '../engine/systemCurve';
import { SystemCurveChart } from './SystemCurveChart';

interface SystemCurvePanelProps {
  result: CalculationResult;
  config: ProjectConfig;
}

/** Portata leggibile all'italiana: 1.009 l/min. */
function flowText(value: number | null): string {
  if (value === null) return '0 l/min';
  return Math.round(value).toLocaleString('it-IT') + ' l/min';
}

const Metric: React.FC<{ label: string; value: string; tone?: string; hint?: string }> = ({
  label,
  value,
  tone,
  hint
}) => (
  <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1.5">
    <span className="block text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    <span className={'block text-[13px] font-bold ' + (tone || 'text-slate-100')}>{value}</span>
    {hint && <span className="block text-[10px] leading-tight text-slate-400">{hint}</span>}
  </div>
);

/**
 * Scheda della curva di impianto nel pannello delle pompe: le due curve
 * (richiesta dell'impianto e prevalenza delle pompe in serie), il punto di
 * lavoro e il confronto con la portata di progetto.
 *
 * Il grafico mostra il tratto scelto fra quelli separati dai peli liberi
 * (la partenza e la bocca di ogni motopompa che aspira da vasca, fiume o piscina).
 */
export const SystemCurvePanel: React.FC<SystemCurvePanelProps> = ({ result, config }) => {
  const curve = useMemo(() => calculateSystemCurve(result.points, config), [result.points, config]);
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(0);

  const sections = curve.sections;
  const targetFlowLpm = config.targetFlowLpm;

  // Mentre si modifica l'impianto ci si posiziona sul tratto che limita.
  useEffect(() => {
    if (curve.limitingSectionIndex !== null) setSelected(curve.limitingSectionIndex);
  }, [curve.limitingSectionIndex, sections.length]);

  if (sections.length === 0) return null;

  const section: SystemCurveSection = sections[Math.min(selected, sections.length - 1)];
  const selectedIndex = section.index;
  const limiting = curve.limitingSectionIndex !== null ? sections[curve.limitingSectionIndex] : undefined;

  const flowBelowTarget =
    section.operatingFlowLpm !== null && targetFlowLpm > 0 && section.operatingFlowLpm < targetFlowLpm * 0.999;
  const flowTone =
    section.operatingFlowLpm === null || flowBelowTarget ? 'text-red-300' : 'text-emerald-300';

  const badgeTone =
    curve.sustainableFlowLpm === null || (targetFlowLpm > 0 && curve.sustainableFlowLpm < targetFlowLpm * 0.999)
      ? 'bg-red-950/70 text-red-300 border-red-800'
      : 'bg-emerald-950/70 text-emerald-300 border-emerald-800';

  const targetText = targetFlowLpm > 0 ? Math.round(targetFlowLpm).toLocaleString('it-IT') + ' l/min' : '—';
  const sectionDelta =
    section.operatingFlowLpm !== null && targetFlowLpm > 0
      ? Math.round((section.operatingFlowLpm / targetFlowLpm - 1) * 100)
      : null;

  const pumps = section.pumps;
  const anyThrottled = pumps.some(p => p.isThrottled);
  const missingBar = -section.marginAtDesignBar;

  return (
    <section className="border-b border-slate-800 bg-slate-950/50">
      <button
        type="button"
        onClick={() => setOpen(previous => !previous)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <TrendingUp className="h-4 w-4 shrink-0 text-sky-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-200 sm:text-xs">
          Curva di impianto
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className={'rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ' + badgeTone}>
            {flowText(curve.sustainableFlowLpm)}
          </span>
          <ChevronDown
            className={'h-4 w-4 text-slate-400 transition-transform ' + (open ? 'rotate-180' : '')}
          />
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <p className="pb-2 text-[11px] leading-snug text-slate-400">
            La <span className="text-sky-300">curva dell'impianto</span> è la prevalenza che serve per far
            passare una portata: dislivello, pressione al terminale e perdite di carico. Quella{' '}
            <span className="text-amber-300">gialla</span> è la prevalenza delle pompe in serie. Si incrociano
            nella portata che l'impianto riesce davvero a muovere.
          </p>

          {sections.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {sections.map((item, index) => (
                <button
                  key={item.label + index}
                  type="button"
                  onClick={() => setSelected(index)}
                  className={
                    'flex min-w-[calc(50%-0.25rem)] flex-1 cursor-pointer flex-col rounded-lg border px-2 py-1 text-left transition ' +
                    (index === selectedIndex
                      ? 'border-sky-600 bg-slate-900 text-slate-100'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700')
                  }
                >
                  <span className="text-[10px] font-semibold">
                    Tratto {index + 1}
                    {curve.limitingSectionIndex === index && (
                      <span className="ml-1 text-amber-400">· limita</span>
                    )}
                  </span>
                  <span className="truncate font-mono text-[9px] text-slate-500">{item.label}</span>
                  <span className="font-mono text-[10px] text-slate-300">{flowText(item.operatingFlowLpm)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-1.5">
            <SystemCurveChart section={section} targetFlowLpm={targetFlowLpm} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Metric
              label={section.operatingFlowLpm === null ? 'Nessuna portata' : 'Portata stimata'}
              value={flowText(section.operatingFlowLpm)}
              tone={section.operatingFlowLpm === null ? 'text-red-300' : flowTone}
              hint={'progetto ' + targetText + (sectionDelta !== null ? ' · ' + (sectionDelta >= 0 ? '+' : '') + sectionDelta + '%' : '')}
            />
            <Metric
              label="Prevalenza al punto di lavoro"
              value={(section.operatingHeadM ?? section.demandAtDesignM).toFixed(1) + ' m'}
              hint={'statico ' + section.staticDemandM.toFixed(1) + ' m'}
            />
            <Metric
              label="Perdite di carico a progetto"
              value={section.frictionAtDesignM.toFixed(1) + ' m'}
              hint={'richiesta ' + section.demandAtDesignM.toFixed(1) + ' m'}
            />
            <Metric
              label="Fornita dalle pompe a progetto"
              value={section.supplyAtDesignM.toFixed(1) + ' m'}
              hint={'margine ' + section.engineMarginBar.toFixed(2) + ' bar ' + (section.isLastSection ? 'alla lancia' : 'nel pelo libero')}
            />
          </div>

          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex items-start gap-1.5 text-slate-400">
              <Waves className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span>
                Tratto {section.index + 1}: <span className="text-slate-300">{section.label}</span>
                {section.pumpsMaxFlowLpm !== null && (
                  <>
                    {' '}— limite pompe <span className="font-mono text-slate-300">{flowText(section.pumpsMaxFlowLpm)}</span>
                  </>
                )}
              </span>
            </div>

            {section.sourcePressureBar > 0 && (
              <div className="flex items-start gap-1.5 text-slate-400">
                <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  Partenza in pressione: <span className="font-mono text-slate-300">{section.sourcePressureBar} bar</span>
                </span>
              </div>
            )}

            {pumps.map((pump, index) => (
              <div key={pump.name + index} className="flex items-start gap-1.5 text-slate-400">
                <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  <span className="text-slate-300">{pump.name}</span> a {Math.round(pump.stationM)} m:{' '}
                  <span className="font-mono text-slate-300">{pump.boostAtDesignBar.toFixed(2)} bar</span> a progetto
                  {pump.suctionLiftM > 0 && <>, aspirazione {pump.suctionLiftM} m</>}
                </span>
              </div>
            ))}

            {section.isPumpLimited && (
              <div className="flex items-start gap-1.5 text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Il limite non è la condotta ma le pompe: oltre {flowText(section.pumpsMaxFlowLpm)} la macchina
                  andrebbe fuori curva.
                </span>
              </div>
            )}

            {!section.isCovered && (
              <div className="flex items-start gap-1.5 text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Alla portata di progetto mancano {missingBar.toFixed(2)} bar: le pompe di questo tratto non
                  coprono la prevalenza richiesta.
                </span>
              </div>
            )}

            {pumps.length === 0 && (
              <div className="flex items-start gap-1.5 text-slate-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>Nessuna motopompa in questo tratto: la curva gialla è solo il carico di partenza.</span>
              </div>
            )}

            {anyThrottled && (
              <div className="flex items-start gap-1.5 text-slate-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>Mandata regolata dall'operatore: la curva mostra la pressione impostata, non il massimo.</span>
              </div>
            )}

            {sections.length > 1 && (
              <div className="flex items-start gap-1.5 text-slate-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>
                  I peli liberi (partenza e aspirazioni da vascone, fiume o vasca) spezzano
                  l'impianto in {sections.length} tratti indipendenti: ognuno ha la sua curva, e vale
                  il più debole
                  {curve.sustainableFlowLpm !== null ? ' — ' + flowText(curve.sustainableFlowLpm) : ''}.
                </span>
              </div>
            )}

            {limiting && limiting.operatingFlowLpm !== null && sections.length > 1 && (
              <div className="flex items-start gap-1.5 text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>Tratto che limita: {limiting.label}.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
