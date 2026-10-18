import React from 'react';
import {
  Flame,
  FileSpreadsheet,
  Navigation,
  Gauge,
  Layers,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { CalculationResult, SavedScenario } from '../types';
import { ScenarioMenu } from './ScenarioMenu';

interface NavbarProps {
  activeTab: 'project' | 'gps' | 'pumps' | 'report';
  setActiveTab: (tab: 'project' | 'gps' | 'pumps' | 'report') => void;
  result: CalculationResult;
  onOpenImportExport: () => void;
  savedScenarios: SavedScenario[];
  /** Nome dello scenario attivo, mostrato nel menù "salva rapido". */
  currentScenarioLabel: string;
  onSaveCurrentScenario: (name: string) => void;
  onLoadSavedScenario: (id: string) => void;
  onDeleteSavedScenario: (id: string) => void;
  onLoadExampleScenario: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  result,
  onOpenImportExport,
  savedScenarios,
  currentScenarioLabel,
  onSaveCurrentScenario,
  onLoadSavedScenario,
  onDeleteSavedScenario,
  onLoadExampleScenario
}) => {
  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-2.5">
            <div className="bg-gradient-to-tr from-red-600 to-amber-500 p-2 rounded-xl shadow-lg text-white">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-slate-100 text-base tracking-tight">
                  IdroCondotta <span className="text-red-500">VVF</span>
                </span>
                <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-800 px-1.5 py-0.2 rounded font-mono font-bold">
                  AIB / EN 1028
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Calcolo Staffette Idrauliche & Piezometrica
              </p>
            </div>
          </div>

          {/* Status Pill on mobile */}
          <div className="md:hidden">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                result.summary.isFeasible
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : 'bg-red-950 text-red-300 border-red-700'
              }`}
            >
              {result.summary.isFeasible ? 'FATTIBILE' : 'NON FATTIBILE'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full md:w-auto justify-center">
          <button
            onClick={() => setActiveTab('project')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'project'
                ? 'bg-sky-600 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Condotta & Grafico</span>
          </button>

          <button
            onClick={() => setActiveTab('gps')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'gps'
                ? 'bg-emerald-600 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Modalità GPS Live</span>
          </button>

          <button
            onClick={() => setActiveTab('pumps')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'pumps'
                ? 'bg-amber-600 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Catalogo Pompe</span>
          </button>
        </div>

        {/* Actions & Scenarios */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          {/* Salva rapido / Scenari */}
          <ScenarioMenu
            savedScenarios={savedScenarios}
            currentLabel={currentScenarioLabel}
            onSaveCurrent={onSaveCurrentScenario}
            onLoadSaved={onLoadSavedScenario}
            onDeleteSaved={onDeleteSavedScenario}
            onLoadExample={onLoadExampleScenario}
          />

          {/* Import / Export button */}
          <button
            onClick={onOpenImportExport}
            className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 cursor-pointer"
            title="Importa o Esporta file CSV / Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">CSV / Excel</span>
          </button>

          {/* Desktop Feasibility Badge */}
          <div className="hidden md:flex items-center">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                result.summary.isFeasible
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                  : 'bg-red-950/90 text-red-300 border-red-700'
              }`}
            >
              {result.summary.isFeasible ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  <span>FATTIBILE ({result.summary.endPressureBar.toFixed(1)} bar)</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 mr-1 text-red-400" />
                  <span>NON FATTIBILE</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
