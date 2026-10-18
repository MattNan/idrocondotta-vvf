import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  X
} from 'lucide-react';
import { EquipmentItem, PumpType, CalculationResult, CalculatedPoint, ProjectConfig } from '../types';
import { findPumpType, getPumpCatalogue } from '../engine/pumpCatalogue';
import { PumpCurvePreview } from './PumpCurvePreview';
import { PumpOptions } from './PumpOptions';
import { SystemCurvePanel } from './SystemCurvePanel';

interface EquipmentPanelProps {
  equipment: EquipmentItem[];
  onChangeEquipment: (next: EquipmentItem[]) => void;
  result: CalculationResult;
  /** Catalogo motopompe in uso (unico elenco, tutti i modelli sono disponibili). */
  pumpTypes: PumpType[];
  targetFlowLpm: number;
  highlightStationM?: number;
  /** Parametri idraulici correnti (serve alla curva di impianto). */
  config: ProjectConfig;
}

const DEFAULT_PUMP_CONFIG = { pumpTypeId: 'pump-8-8', mode: 'direct' as const };

export const EquipmentPanel: React.FC<EquipmentPanelProps> = ({
  equipment,
  onChangeEquipment,
  result,
  pumpTypes,
  targetFlowLpm,
  highlightStationM,
  config
}) => {
  const [newDistanceM, setNewDistanceM] = useState<number | ''>('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** Messaggio d'errore mostrato in linea: niente finestre bloccanti (alert). */
  const [addError, setAddError] = useState<string | null>(null);

  const allPumps = getPumpCatalogue(pumpTypes);
  const sorted = [...equipment].sort((a, b) => a.distanceM - b.distanceM);

  const getCalcPoint = (item: EquipmentItem) =>
    result.points.find(p => p.node.id === item.id);

  const handleUpdate = (id: string, updates: Partial<EquipmentItem>) => {
    onChangeEquipment(equipment.map(e => (e.id === id ? { ...e, ...updates } : e)));
  };

  const handleUpdatePumpConfig = (
    id: string,
    pumpUpdates: Partial<NonNullable<EquipmentItem['pumpConfig']>>
  ) => {
    onChangeEquipment(
      equipment.map(e => {
        if (e.id !== id) return e;
        const currentConfig = e.pumpConfig || DEFAULT_PUMP_CONFIG;
        return { ...e, pumpConfig: { ...currentConfig, ...pumpUpdates } };
      })
    );
  };

  const handleAdd = () => {
    if (newDistanceM === '') {
      setAddError('Indica la progressiva [m] dove installare la motopompa.');
      return;
    }
    setAddError(null);
    const item: EquipmentItem = {
      id: `eq-pump-${Date.now()}`,
      distanceM: Number(newDistanceM),
      kind: 'pump',
      pumpConfig: DEFAULT_PUMP_CONFIG
    };
    onChangeEquipment([...equipment, item]);
    setNewDistanceM('');
  };

  const previewItem = sorted.find(e => e.id === previewId);

  const renderStatus = (calcPt?: CalculatedPoint) => {
    if (calcPt?.status === 'danger') {
      return (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-red-950/80 text-red-300 border border-red-700"
          title={calcPt.statusMessage}
        >
          <XCircle className="w-3 h-3" />
        </span>
      );
    }
    if (calcPt?.status === 'warning') {
      return (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-amber-950/80 text-amber-300 border border-amber-700"
          title={calcPt.statusMessage}
        >
          <AlertTriangle className="w-3 h-3" />
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans text-emerald-300 bg-emerald-950/60 border border-emerald-800/80"
        title={calcPt?.statusMessage}
      >
        <CheckCircle2 className="w-3 h-3" />
      </span>
    );
  };

  const renderPressure = (value: number | undefined, kind: 'in' | 'out', note?: string) => {
    if (note) {
      return (
        <span className="text-cyan-400/90 font-sans text-[11px]" title={note}>
          asp.
        </span>
      );
    }
    if (value === undefined) return <span className="text-slate-500">-</span>;
    const cls =
      value < 0
        ? 'text-red-400'
        : value < 1.0
        ? 'text-amber-400'
        : value > 12
        ? 'text-red-400'
        : kind === 'out'
        ? 'text-sky-300'
        : 'text-slate-300';
    return <span className={`font-bold ${cls}`}>{value.toFixed(2)}</span>;
  };

  /**
   * Comandi di configurazione di una macchina: identici nella tabella (schermi
   * larghi) e nelle schede (smartphone e tablet), così non c'è più nulla da
   * scorrere lateralmente per leggere la dotazione.
   */
  const renderConfig = (item: EquipmentItem, calcPt?: CalculatedPoint) => {
    return (
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-lg border border-slate-800">
        <select
          value={item.pumpConfig?.pumpTypeId || 'pump-8-8'}
          onChange={e => handleUpdatePumpConfig(item.id, { pumpTypeId: e.target.value })}
          className="bg-slate-800 border border-slate-700 text-amber-300 rounded px-1.5 py-0.5 text-[11px] font-semibold focus:outline-hidden max-w-[200px] truncate"
          aria-label="Modello motopompa"
        >
          {allPumps.length === 0 && (
            <option value={item.pumpConfig?.pumpTypeId || 'pump-8-8'}>
              Catalogo vuoto — gestisci pompe
            </option>
          )}
          <PumpOptions pumpTypes={pumpTypes} />
        </select>

        <select
          value={item.pumpConfig?.mode || 'direct'}
          onChange={e =>
            handleUpdatePumpConfig(item.id, {
              mode: e.target.value as 'direct' | 'vascone_suction',
              suctionLiftM:
                e.target.value === 'vascone_suction'
                  ? item.pumpConfig?.suctionLiftM || 2.0
                  : 0
            })
          }
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[11px] focus:outline-hidden"
          aria-label="Modalità della motopompa"
        >
          <option value="direct">In Diretta</option>
          <option value="vascone_suction">Asp. Pelo Libero</option>
        </select>

        {item.pumpConfig?.mode === 'vascone_suction' && (
          <div className="flex items-center space-x-1 text-[10px] font-mono text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
            <span>H_asp:</span>
            <input
              type="number"
              value={item.pumpConfig?.suctionLiftM || 0}
              onChange={e =>
                handleUpdatePumpConfig(item.id, {
                  suctionLiftM: Number(e.target.value)
                })
              }
              step="0.5"
              min="0"
              max="8"
              className="w-10 bg-transparent text-center font-bold focus:outline-hidden text-cyan-200"
              aria-label="Altezza di aspirazione"
            />
            <span>m</span>
          </div>
        )}

        <div className="flex items-center space-x-1 text-[10px] font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
          <span
            className="text-slate-400"
            title="Regolazione mandata pompa tra 0 e max curva P(Q)"
          >
            ΔP:
          </span>
          <input
            type="number"
            value={
              item.pumpConfig?.regulatedBoostBar !== undefined
                ? item.pumpConfig.regulatedBoostBar
                : calcPt?.node.pumpConfig?.effectiveBoostBar ?? 8.0
            }
            onChange={e => {
              const val = Number(e.target.value);
              const maxAvail = calcPt?.node.pumpConfig?.maxAvailableBoostBar ?? 16.0;
              handleUpdatePumpConfig(item.id, {
                regulatedBoostBar: Math.max(0, Math.min(val, maxAvail))
              });
            }}
            min={0}
            max={calcPt?.node.pumpConfig?.maxAvailableBoostBar ?? 16.0}
            step={0.2}
            className="w-12 bg-transparent text-center font-bold text-amber-300 focus:outline-hidden"
            aria-label="Pressione di mandata regolata"
            title={`Pressione mandata regolabile tra 0 e ${
              calcPt?.node.pumpConfig?.maxAvailableBoostBar?.toFixed(1) || 8.0
            } bar (max da curva a questa portata)`}
          />
          <span className="text-slate-400">b</span>
          <span
            className="text-[9px] text-slate-500 font-sans"
            title="Pressione massima teorica da curva"
          >
            (max: {calcPt?.node.pumpConfig?.maxAvailableBoostBar?.toFixed(1) || '--'})
          </span>

          <button
            type="button"
            onClick={() =>
              handleUpdatePumpConfig(item.id, {
                regulatedBoostBar: calcPt?.node.pumpConfig?.maxAvailableBoostBar
              })
            }
            className="px-1 py-0.2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded text-[9px] font-bold border border-slate-700 transition cursor-pointer"
            title="Ripristina al 100% della curva (pieno acceleratore)"
          >
            MAX
          </button>

          <button
            type="button"
            onClick={() => setPreviewId(previewId === item.id ? null : item.id)}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded border border-slate-700 transition ml-0.5 cursor-pointer"
            title="Visualizza anteprima curva caratteristica P-Q"
            aria-label="Anteprima curva P-Q"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderDeleteButton = (item: EquipmentItem) => (
    <button
      onClick={() => onChangeEquipment(equipment.filter(e => e.id !== item.id))}
      className="text-slate-500 hover:text-red-400 p-1 hover:bg-red-950/40 rounded transition cursor-pointer"
      title="Elimina macchina"
      aria-label={`Elimina la macchina a ${item.distanceM} m`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div className="flex items-center space-x-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs sm:text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Motopompe ({sorted.length})
          </h3>
        </div>
        <div className="text-[11px] text-slate-400 hidden sm:block">
          Progressiva · configurazione · stato idraulico
        </div>
      </div>

      {/* Curva di impianto: richiesta dell'impianto contro prevalenza delle pompe */}
      <SystemCurvePanel result={result} config={config} />

      {/* Anteprima curva P-Q */}
      {previewItem && previewItem.kind === 'pump' && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <PumpCurvePreview
              pump={findPumpType(
                previewItem.pumpConfig?.pumpTypeId || 'pump-8-8',
                pumpTypes
              )}
              currentFlowLpm={targetFlowLpm}
              regulatedBoostBar={getCalcPoint(previewItem)?.pumpBoostBar}
              onRegulateBoost={val => handleUpdatePumpConfig(previewItem.id, { regulatedBoostBar: val })}
            />
          </div>
          <button
            onClick={() => setPreviewId(null)}
            className="self-end sm:self-start text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4 mr-1 inline" /> Chiudi Anteprima
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------
          Schede: smartphone e tablet (< 1280 px). Tutto visibile in
          verticale, senza tabelle larghe e senza scorrimento laterale.
      -------------------------------------------------------------- */}
      <div className="xl:hidden divide-y divide-slate-800">
        {sorted.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            Nessuna macchina installata. Aggiungine una qui sotto indicando la progressiva.
          </div>
        ) : (
          sorted.map(item => {
            const calcPt = getCalcPoint(item);
            const isHighlighted =
              highlightStationM !== undefined &&
              Math.abs(item.distanceM - highlightStationM) < 1;

            return (
              <div
                key={item.id}
                className={`p-3 space-y-2 bg-slate-900/40 ${
                  isHighlighted ? 'border-l-4 border-sky-400 bg-sky-950/30' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    Prog.
                  </span>
                  <input
                    type="number"
                    value={item.distanceM}
                    onChange={e => handleUpdate(item.id, { distanceM: Number(e.target.value) })}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 font-mono text-xs focus:outline-hidden focus:border-sky-500"
                    aria-label="Progressiva della macchina"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">m</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-400 flex items-center">
                    <Flame className="w-3 h-3 mr-1" /> Motopompa
                  </span>
                  {renderDeleteButton(item)}
                </div>

                {renderConfig(item, calcPt)}

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1.5">
                    <span className="block text-[10px] uppercase text-slate-500">P in</span>
                    <span className="font-mono">
                      {renderPressure(
                        calcPt?.inletPressureBar,
                        'in',
                        item.pumpConfig?.mode === 'vascone_suction'
                          ? 'Lato aspirazione in depressione per progetto (prevalenza di aspirazione)'
                          : undefined
                      )}
                      <span className="text-slate-500 text-[10px] ml-1">bar</span>
                    </span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1.5">
                    <span className="text-[10px] uppercase text-slate-500 block">P out</span>
                    {renderPressure(calcPt?.outletPressureBar, 'out')}
                    <span className="text-slate-500 text-[10px]"> bar</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] uppercase text-slate-500">Stato</span>
                    {renderStatus(calcPt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --------------------------------------------------------------
          Tabella: schermi larghi (>= 1280 px), dove le 7 colonne entrano.
      -------------------------------------------------------------- */}
      <div className="hidden xl:block w-full">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px]">
            <tr>
              <th className="py-2 px-2.5 font-semibold w-20">Prog. [m]</th>
              <th className="py-2 px-2 font-semibold w-28">Tipo</th>
              <th className="py-2 px-2.5 font-semibold">Configurazione</th>
              <th className="py-2 px-2 font-semibold text-center w-16">P in [bar]</th>
              <th className="py-2 px-2 font-semibold text-center w-16">P out [bar]</th>
              <th className="py-2 px-2 font-semibold text-center w-14">Stato</th>
              <th className="py-2 px-1 text-center w-7"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {sorted.map(item => {
              const calcPt = getCalcPoint(item);
              const isHighlighted =
                highlightStationM !== undefined &&
                Math.abs(item.distanceM - highlightStationM) < 1;

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isHighlighted ? 'bg-sky-950/40 border-l-4 border-sky-400' : ''
                  }`}
                >
                  <td className="py-1.5 px-2.5 text-slate-200">
                    <input
                      type="number"
                      value={item.distanceM}
                      onChange={e => handleUpdate(item.id, { distanceM: Number(e.target.value) })}
                      className="w-16 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-sky-500 text-slate-100 font-mono py-0.5 focus:outline-hidden"
                      aria-label="Progressiva macchina"
                    />
                  </td>

                  <td className="py-1.5 px-2 font-sans text-amber-400">Motopompa</td>

                  <td className="py-1.5 px-2.5 font-sans">{renderConfig(item, calcPt)}</td>

                  <td className="py-1.5 px-2 text-center">
                    {renderPressure(
                      calcPt?.inletPressureBar,
                      'in',
                      item.pumpConfig?.mode === 'vascone_suction'
                        ? 'Lato aspirazione in depressione per progetto (prevalenza di aspirazione)'
                        : undefined
                    )}
                  </td>

                  <td className="py-1.5 px-2 text-center">
                    {renderPressure(calcPt?.outletPressureBar, 'out')}
                  </td>

                  <td className="py-1.5 px-2 text-center">{renderStatus(calcPt)}</td>

                  <td className="py-1.5 px-1 text-center">{renderDeleteButton(item)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Aggiunta macchina */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-400 flex items-center">
            <Plus className="w-3.5 h-3.5 mr-1 text-sky-400" /> Aggiungi a:
          </span>
          <input
            type="number"
            placeholder="Progressiva [m]"
            value={newDistanceM}
            onChange={e => {
              setNewDistanceM(e.target.value === '' ? '' : Number(e.target.value));
              if (addError) setAddError(null);
            }}
            className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-hidden focus:border-sky-500"
            aria-label="Progressiva della nuova macchina"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium transition cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 mr-1" /> Motopompa
          </button>
          <span className="text-[10px] text-slate-500 ml-auto hidden sm:inline">
            Quota Z interpolata dal profilo · una motopompa in aspirazione dichiara il pelo libero
          </span>
        </div>

        {addError && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-700/60 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{addError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
