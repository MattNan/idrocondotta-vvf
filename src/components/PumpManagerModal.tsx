import React, { useState } from 'react';
import { X, Plus, Trash2, Gauge, Info, Check, RotateCcw, AlertTriangle, Star } from 'lucide-react';
import { PumpType } from '../types';
import { DEFAULT_PUMP_TYPES, getPumpCatalogue } from '../engine/pumpCatalogue';

interface PumpManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Catalogo in uso: unico elenco, tutti i modelli sono modificabili ed eliminabili. */
  pumpTypes: PumpType[];
  onSavePumpTypes: (pumps: PumpType[]) => void;
}

export const PumpManagerModal: React.FC<PumpManagerModalProps> = ({
  isOpen,
  onClose,
  pumpTypes,
  onSavePumpTypes
}) => {
  const [name, setName] = useState('');
  const [nominalFlow, setNominalFlow] = useState(800);
  const [nominalHead, setNominalHead] = useState(10.0);
  const [maxShutoff, setMaxShutoff] = useState(14.0);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const catalogue = getPumpCatalogue(pumpTypes);

  const handleAddPump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Inserisci il nome o modello della motopompa.');
      return;
    }
    if (nominalFlow <= 0 || nominalHead <= 0) {
      setError('Portata e prevalenza devono essere valori positivi.');
      return;
    }

    const newPump: PumpType = {
      id: `custom-pump-${Date.now()}`,
      name: name.trim(),
      nominalFlowLpm: Number(nominalFlow),
      nominalHeadBar: Number(nominalHead),
      shutoffPressureBar: Number(maxShutoff) || Number(nominalHead) * 1.3,
      maxFlowLpm: Math.round(Number(nominalFlow) * 1.35),
      description: description.trim() || undefined
    };

    onSavePumpTypes([...catalogue, newPump]);
    setName('');
    setDescription('');
    setError('');
  };

  const handleDeletePump = (id: string) => {
    onSavePumpTypes(catalogue.filter(p => p.id !== id));
    setConfirmDeleteId(null);
  };

  const handleToggleFavourite = (id: string) => {
    onSavePumpTypes(
      catalogue.map(p => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))
    );
  };

  const handleRestoreDefaults = () => {
    onSavePumpTypes(DEFAULT_PUMP_TYPES.map(p => ({ ...p })));
    setConfirmReset(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center space-x-2">
            <Gauge className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Catalogo Motopompe</h2>
            <span className="text-xs text-slate-400 font-mono">
              ({catalogue.length} · {catalogue.filter(p => p.isFavorite).length} ★)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Chiudi il catalogo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Un unico elenco di modelli: puoi aggiungerne, eliminarne o ripristinare quelli
              predefiniti. La sigla <span className="font-mono text-slate-300">8/8</span> indica la
              portata in centinaia di l/min alla pressione nominale in bar (800 l/min a 8 bar). I
              modelli con la <Star className="w-3 h-3 inline text-amber-400 fill-current -mt-0.5" />{' '}
              compaiono in cima ai menù di scelta, sotto "Preferite".
            </p>
            {confirmReset ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-amber-300">Ripristinare?</span>
                <button
                  onClick={handleRestoreDefaults}
                  className="px-2 py-1 text-[11px] font-medium rounded-md bg-amber-600 hover:bg-amber-500 text-white transition cursor-pointer"
                >
                  Sì
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1 text-[11px] font-medium rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="shrink-0 inline-flex items-center px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                title="Ripristina i modelli predefiniti"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Ripristina predefiniti
              </button>
            )}
          </div>

          {catalogue.length === 0 ? (
            <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-700/50 rounded-xl p-3 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Il catalogo è vuoto. Aggiungi un modello oppure usa "Ripristina predefiniti" per
                ricaricare i modelli standard.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catalogue.map(p => (
                <div
                  key={p.id}
                  className={`bg-slate-800/60 border rounded-xl p-3 text-sm flex flex-col justify-between ${
                    p.isFavorite ? 'border-amber-600/60' : 'border-slate-700/60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-200">{p.name}</span>
                      {confirmDeleteId === p.id ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDeletePump(p.id)}
                            className="px-1.5 py-0.5 text-[11px] font-medium rounded bg-red-600 hover:bg-red-500 text-white transition cursor-pointer"
                          >
                            Elimina
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 text-[11px] font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => handleToggleFavourite(p.id)}
                            className={`p-1 rounded transition cursor-pointer ${
                              p.isFavorite
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-slate-500 hover:text-amber-300'
                            }`}
                            title={
                              p.isFavorite
                                ? 'Rimuovi dalle pompe preferite'
                                : 'Aggiungi alle pompe preferite'
                            }
                            aria-label={
                              p.isFavorite
                                ? `Rimuovi ${p.name} dalle pompe preferite`
                                : `Aggiungi ${p.name} alle pompe preferite`
                            }
                            aria-pressed={!!p.isFavorite}
                          >
                            <Star className={`w-4 h-4 ${p.isFavorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="text-slate-500 hover:text-red-400 p-1 hover:bg-red-950/40 rounded-sm transition cursor-pointer"
                            title="Elimina modello dal catalogo"
                            aria-label={`Elimina ${p.name} dal catalogo`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <div className="text-xs text-slate-400 mt-1">{p.description}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/40 text-xs">
                    <span className="text-amber-300 font-mono">Q: {p.nominalFlowLpm} l/min</span>
                    <span className="text-sky-300 font-mono font-bold">
                      H: {p.nominalHeadBar} bar
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Pump Form */}
          <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center">
              <Plus className="w-4 h-4 mr-1.5 text-sky-400" /> Aggiungi Motopompa al Catalogo
            </h3>

            {error && (
              <div className="bg-red-900/40 border border-red-700 text-red-200 text-xs p-2.5 rounded-lg mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleAddPump} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome o Sigla Modello
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Es. Pompa APS Rosenbauer NH35 / Portatile Honda 500"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Portata Nominale [l/min]
                  </label>
                  <input
                    type="number"
                    value={nominalFlow}
                    onChange={e => setNominalFlow(Number(e.target.value))}
                    min="50"
                    max="5000"
                    step="50"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-hidden focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Prevalenza Nominale [bar]
                  </label>
                  <input
                    type="number"
                    value={nominalHead}
                    onChange={e => setNominalHead(Number(e.target.value))}
                    min="1"
                    max="40"
                    step="0.5"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-hidden focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Pressione Max Shutoff [bar]
                  </label>
                  <input
                    type="number"
                    value={maxShutoff}
                    onChange={e => setMaxShutoff(Number(e.target.value))}
                    min="1"
                    max="50"
                    step="0.5"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Descrizione o Note d'impiego (opzionale)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Es. Pressione massima di mandata tarata a valvola di scarico"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Salva Modello nel Catalogo
                </button>
              </div>
            </form>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-500">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <Check className="w-3 h-3 inline text-emerald-400 mr-0.5" />
              Il catalogo viene salvato nel browser e resta disponibile al prossimo avvio.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
