import React from 'react';
import {
  Settings,
  Droplets,
  CircleDot,
  Gauge,
  Sliders,
  Layers
} from 'lucide-react';
import { ProjectConfig, CalculationResult } from '../types';
import { getPumpCatalogue } from '../engine/pumpCatalogue';

interface ControlPanelProps {
  config: ProjectConfig;
  onChangeConfig: (newConfig: ProjectConfig) => void;
  result: CalculationResult;
  onOpenPumpCatalogue: () => void;
  /**
   * La macchina alla progressiva 0 è una motopompa in aspirazione da pelo libero:
   * in quel caso la pressione di sorgente non viene usata dal calcolo.
   */
  sourceIsSuctionPump?: boolean;
  /** Alla progressiva 0 c'è una motopompa in diretta: la P. Sorgente si somma. */
  sourceHasDirectPump?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onChangeConfig,
  result,
  onOpenPumpCatalogue,
  sourceIsSuctionPump = false,
  sourceHasDirectPump = false
}) => {
  const updateField = <K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]) => {
    onChangeConfig({
      ...config,
      [key]: value
    });
  };

  // 6 pulsanti a passo costante 200 l/min da 200 a 1200
  const quickFlows = [200, 400, 600, 800, 1000, 1200];

  // Calcolo perdita in bar per 100m per feedback immediato
  const lossBarPer100m = (result.unitLossJ * 100 * (1 + config.localizedLossPercent / 100)) * 0.0980665;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Settings className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Parametri Idraulici Condotta
          </h3>
        </div>
        <button
          onClick={onOpenPumpCatalogue}
          className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg flex items-center space-x-1 transition cursor-pointer"
        >
          <Gauge className="w-3.5 h-3.5 mr-1" />
          <span>Gestisci Pompe ({getPumpCatalogue(config.pumpTypes).length})</span>
        </button>
      </div>

      {/* 1. Portata di Progetto Q: Slider perfettamente allineato con i pulsanti 200-1200 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center">
            <Droplets className="w-3.5 h-3.5 mr-1.5 text-sky-400" /> Portata di Progetto (Q)
          </label>
          <div className="flex items-center space-x-1">
            <input
              type="number"
              value={config.targetFlowLpm}
              onChange={e => updateField('targetFlowLpm', Math.max(100, Math.min(2000, Number(e.target.value))))}
              step="50"
              min="200"
              max="1200"
              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-right font-mono font-bold text-sky-300 text-sm focus:outline-hidden focus:border-sky-500"
            />
            <span className="text-xs text-slate-400 font-mono">l/min</span>
          </div>
        </div>

        {/* Range Slider 200 - 1200 con passo 50 */}
        <div className="px-1 py-1">
          <input
            type="range"
            min="200"
            max="1200"
            step="50"
            value={Math.min(1200, Math.max(200, config.targetFlowLpm))}
            onChange={e => updateField('targetFlowLpm', Number(e.target.value))}
            className="w-full accent-sky-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Pulsanti perfettamente allineati 1:1 sotto i passi dello slider */}
        <div className="flex justify-between mt-1 px-0.5">
          {quickFlows.map(q => (
            <button
              key={q}
              onClick={() => updateField('targetFlowLpm', q)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                config.targetFlowLpm === q
                  ? 'bg-sky-600 text-white font-bold shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Diametro Tubazione e Spezzoni */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center">
            <CircleDot className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Diametro Condotta
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => updateField('defaultDiameterMm', 70)}
              className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer flex flex-col items-center ${
                config.defaultDiameterMm === 70
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>UNI 70</span>
              <span className="text-[10px] font-normal opacity-80">(Ø 70 mm)</span>
            </button>
            <button
              onClick={() => updateField('defaultDiameterMm', 45)}
              className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer flex flex-col items-center ${
                config.defaultDiameterMm === 45
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>UNI 45</span>
              <span className="text-[10px] font-normal opacity-80">(Ø 45 mm)</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center">
            <Layers className="w-3.5 h-3.5 mr-1 text-purple-400" /> Spezzone Manichetta
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => updateField('hoseSectionLengthM', 20)}
              className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                config.hoseSectionLengthM === 20
                  ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              20 metri
            </button>
            <button
              onClick={() => updateField('hoseSectionLengthM', 30)}
              className={`py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                config.hoseSectionLengthM === 30
                  ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              30 metri
            </button>
          </div>
        </div>
      </div>

      {/* 3. Riscontro dinamico Velocità e Perdite Hazen-Williams */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-xs grid grid-cols-2 gap-2">
        <div>
          <span className="text-slate-400 block text-[11px]">Velocità Fluido (v):</span>
          <span className={`font-mono font-bold text-sm ${
            result.flowVelocityMs > 3.0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {result.flowVelocityMs.toFixed(2)} m/s
          </span>
          {result.flowVelocityMs > 3.0 && (
            <span className="text-[10px] text-amber-500 block leading-tight">Elevata (&gt;3 m/s)</span>
          )}
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Perdita per 100 m:</span>
          <span className="font-mono font-bold text-sm text-sky-400">
            {lossBarPer100m.toFixed(2)} bar
          </span>
          <span className="text-[10px] text-slate-400 block">({(result.unitLossJ * 100).toFixed(1)} m c.a./100m)</span>
        </div>
      </div>

      {/* 4. Parametri Hazen-Williams & Perdite Localizzate */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span className="flex items-center">
            <Sliders className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Coefficienti & Perdite
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Hazen-Williams</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Scabrezza C</label>
            <input
              type="number"
              value={config.hazenWilliamsC}
              onChange={e => updateField('hazenWilliamsC', Number(e.target.value))}
              min="100"
              max="160"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">+ % Localizzate</label>
            <div className="relative">
              <input
                type="number"
                value={config.localizedLossPercent}
                onChange={e => updateField('localizedLossPercent', Number(e.target.value))}
                min="0"
                max="50"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs focus:outline-hidden"
              />
              <span className="absolute right-2 top-1 text-[10px] text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Limiti di Pressione e Condizioni al Contorno */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <div className="text-xs font-semibold text-slate-300 flex items-center">
          <Gauge className="w-3.5 h-3.5 mr-1 text-red-400" />
          Soglie di Sicurezza e Pressioni
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">P. Max Tubo</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={config.maxLinePressureBar}
                onChange={e => updateField('maxLinePressureBar', Number(e.target.value))}
                min="6"
                max="25"
                step="0.5"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-red-300 text-xs focus:outline-hidden"
              />
              <span className="text-slate-400 text-[10px]">bar</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">P. Minima</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={config.minLinePressureBar}
                onChange={e => updateField('minLinePressureBar', Number(e.target.value))}
                min="0.2"
                max="3.0"
                step="0.1"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-amber-300 text-xs focus:outline-hidden"
              />
              <span className="text-slate-400 text-[10px]">bar</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">P. Sorgente</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={config.sourcePressureBar}
                onChange={e => updateField('sourcePressureBar', Number(e.target.value))}
                min="0"
                max="20"
                step="0.5"
                disabled={sourceIsSuctionPump}
                title={
                  sourceIsSuctionPump
                    ? 'La pompa di partenza aspira a pelo libero: la pressione di sorgente non viene applicata.'
                    : sourceHasDirectPump
                    ? 'Pressione all\'origine: si somma alla motopompa di partenza in diretta.'
                    : 'Pressione residua disponibile all\'origine della condotta.'
                }
                className={`w-full border rounded px-2 py-1 font-mono text-xs focus:outline-hidden ${
                  sourceIsSuctionPump
                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-800 border-slate-700 text-emerald-300'
                }`}
              />
              <span className="text-slate-400 text-[10px]">bar</span>
            </div>
            {sourceIsSuctionPump && (
              <p className="text-[10px] text-cyan-300/90 leading-snug mt-1">
                Non applicata: aspirazione a pelo libero (0 bar all'origine).
              </p>
            )}
            {!sourceIsSuctionPump && sourceHasDirectPump && (
              <p className="text-[10px] text-amber-300/90 leading-tight mt-1">
                Si somma alla motopompa in diretta alla partenza.
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">P. Finale Lancia</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={config.requiredEndPressureBar}
                onChange={e => updateField('requiredEndPressureBar', Number(e.target.value))}
                min="0.5"
                max="10"
                step="0.5"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-sky-300 text-xs focus:outline-hidden"
              />
              <span className="text-slate-400 text-[10px]">bar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
