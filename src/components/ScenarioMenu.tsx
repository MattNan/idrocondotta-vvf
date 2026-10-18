import React, { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  Save,
  Trash2,
  Upload,
  BookOpen,
  ChevronDown,
  Check
} from 'lucide-react';
import { SavedScenario } from '../types';
import { SAMPLE_SCENARIOS } from '../data/sampleProfiles';

interface ScenarioMenuProps {
  savedScenarios: SavedScenario[];
  /** Nome mostrato nel pulsante (scenario attivo o progetto corrente). */
  currentLabel: string;
  onSaveCurrent: (name: string) => void;
  onLoadSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onLoadExample: (id: string) => void;
}

const formatDate = (ts: number): string => {
  try {
    return new Date(ts).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

/**
 * Menù "salva rapido": salva il progetto corrente con un nome, ricarica o
 * elimina gli scenari salvati (con conferma) e carica gli esempi integrati.
 */
export const ScenarioMenu: React.FC<ScenarioMenuProps> = ({
  savedScenarios,
  currentLabel,
  onSaveCurrent,
  onLoadSaved,
  onDeleteSaved,
  onLoadExample
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chiusura cliccando fuori dal menù
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveCurrent(trimmed);
    setName('');
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center space-x-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 transition cursor-pointer max-w-[190px]"
        title="Salva rapido e scenari"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Salva rapido */}
          <div className="p-3 border-b border-slate-800">
            <div className="flex items-center space-x-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">
              <Save className="w-3.5 h-3.5" /> Salva rapido
            </div>
            <form onSubmit={handleSave} className="flex items-center gap-1.5">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome scenario (es. Boschivo Valle)"
                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="shrink-0 inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white"
                aria-label="Salva scenario corrente"
              >
                {justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              </button>
            </form>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Salva parametri, profilo, motopompe e percorso GPS.
            </p>
          </div>

          {/* Salvati */}
          <div className="p-3 border-b border-slate-800">
            <div className="flex items-center space-x-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-400 mb-2">
              <BookOpen className="w-3.5 h-3.5" /> Scenari salvati ({savedScenarios.length})
            </div>
            {savedScenarios.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Nessuno scenario salvato. Usa "Salva rapido" per conservare il progetto corrente.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1 -mr-1 pr-1">
                {savedScenarios.map(sc => (
                  <div
                    key={sc.id}
                    className="group flex items-center gap-1.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-2 py-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 truncate">{sc.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {formatDate(sc.createdAt)} · {sc.profile.length} punti
                        {sc.track && sc.track.length > 0 ? ` · ${sc.track.length} GPS` : ''}
                      </div>
                    </div>
                    {confirmDeleteId === sc.id ? (
                      <>
                        <button
                          onClick={() => {
                            onDeleteSaved(sc.id);
                            setConfirmDeleteId(null);
                          }}
                          className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-600 hover:bg-red-500 text-white transition cursor-pointer"
                        >
                          Elimina
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            onLoadSaved(sc.id);
                            setOpen(false);
                          }}
                          className="shrink-0 inline-flex items-center px-2 py-1 text-[10px] font-medium rounded bg-sky-700 hover:bg-sky-600 text-white transition cursor-pointer"
                          title="Carica questo scenario"
                        >
                          <Upload className="w-3 h-3 mr-1" /> Carica
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(sc.id)}
                          className="shrink-0 p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-sm transition cursor-pointer"
                          title="Elimina scenario"
                          aria-label={`Elimina scenario ${sc.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Esempi integrati */}
          <div className="p-3">
            <div className="flex items-center space-x-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-2">
              <BookOpen className="w-3.5 h-3.5" /> Scenari di esempio
            </div>
            <div className="space-y-1">
              {SAMPLE_SCENARIOS.map(sc => (
                <button
                  key={sc.id}
                  onClick={() => {
                    onLoadExample(sc.id);
                    setOpen(false);
                  }}
                  className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-2 py-1.5 transition cursor-pointer"
                >
                  <div className="text-xs text-slate-200 truncate">{sc.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{sc.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
