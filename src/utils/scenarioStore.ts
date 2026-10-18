import { PumpType, SavedScenario } from '../types';
import { DEFAULT_PUMP_TYPES } from '../engine/pumpCatalogue';

/**
 * Persistenza locale (browser) dei dati che l'operatore vuole ritrovare:
 * il catalogo motopompe e gli scenari salvati in fretta dal campo.
 *
 * Tutte le letture degradano con eleganza: se il localStorage non è
 * disponibile o il contenuto è corrotto si torna ai valori predefiniti.
 */

const PUMP_TYPES_KEY = 'idrocondotta.pumpTypes.v1';
const SAVED_SCENARIOS_KEY = 'idrocondotta.savedScenarios.v1';

/**
 * Elenco dei modelli predefiniti già proposti all'operatore. Serve a capire
 * se un modello predefinito che manca dal catalogo salvato è una novità di
 * un aggiornamento (va inserito) oppure un modello che l'operatore ha tolto
 * di proposito (va lasciato fuori).
 */
const PROPOSED_BUILTINS_KEY = 'idrocondotta.pumpCatalogue.proposed.v1';

/** Modelli predefiniti da mettere fra le "preferite" alla prima migrazione. */
const DEFAULT_FAVOURITE_IDS = new Set(
  DEFAULT_PUMP_TYPES.filter(p => p.isFavorite).map(p => p.id)
);

/**
 * Migrazione una tantum: i cataloghi salvati prima dell'introduzione delle
 * "pompe preferite" non hanno il campo `isFavorite`. Alla prima lettura la
 * stella viene assegnata ai modelli predefiniti corrispondenti; da quel
 * momento il campo è esplicito su tutti i modelli e la migrazione non si ripete.
 */
function withFavourites(models: PumpType[]): PumpType[] {
  const alreadyMigrated = models.some(p => typeof p.isFavorite === 'boolean');
  if (alreadyMigrated) return models;
  return models.map(p => ({ ...p, isFavorite: DEFAULT_FAVOURITE_IDS.has(p.id) }));
}

/**
 * Allinea il catalogo salvato ai modelli predefiniti: un modello predefinito
 * che manca dal catalogo e che non è mai stato proposto è stato aggiunto da un
 * aggiornamento e viene inserito al suo posto nell'ordine ufficiale. Un modello
 * già proposto che ora manca è invece stato eliminato dall'operatore e resta
 * eliminato. Il catalogo allineato viene salvato subito, così l'operazione non
 * va persa al ricaricamento.
 */
function withNewBuiltins(models: PumpType[]): PumpType[] {
  const proposedRaw = readJson<unknown>(PROPOSED_BUILTINS_KEY, []);
  const proposed = new Set(
    Array.isArray(proposedRaw)
      ? proposedRaw.filter((id): id is string => typeof id === 'string')
      : []
  );

  const known = new Set(models.map(p => p.id));
  const missing = DEFAULT_PUMP_TYPES.filter(p => !known.has(p.id) && !proposed.has(p.id));
  const allBuiltinIds = DEFAULT_PUMP_TYPES.map(p => p.id);

  const remember = () => {
    writeJson(PROPOSED_BUILTINS_KEY, Array.from(new Set([...proposed, ...allBuiltinIds])));
  };

  if (missing.length === 0) {
    if (proposed.size < allBuiltinIds.length) writeJson(PROPOSED_BUILTINS_KEY, allBuiltinIds);
    return models;
  }

  const byId = new Map(models.map(p => [p.id, p]));
  const merged = DEFAULT_PUMP_TYPES.map(defaults => {
    const stored = byId.get(defaults.id);
    if (!stored) return { ...defaults };
    byId.delete(defaults.id);
    // I dati dell'operatore (nome, stella, prestazioni riviste) vincono sui
    // predefiniti; i campi nuovi del catalogo restano disponibili.
    return { ...defaults, ...stored };
  });

  // I modelli creati a mano dall'operatore restano in coda, al loro posto.
  const aligned = [...merged, ...byId.values()];

  writeJson(PUMP_TYPES_KEY, aligned);
  writeJson(PROPOSED_BUILTINS_KEY, allBuiltinIds);
  return aligned;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota piena o localStorage non disponibile: si prosegue senza persistere.
  }
}

/** Catalogo motopompe salvato, oppure i modelli predefiniti al primo avvio. */
export function loadPumpTypes(): PumpType[] {
  const stored = readJson<PumpType[] | null>(PUMP_TYPES_KEY, null);
  if (!Array.isArray(stored)) return DEFAULT_PUMP_TYPES.map(p => ({ ...p }));
  return withNewBuiltins(withFavourites(stored));
}

export function savePumpTypes(pumpTypes: PumpType[]): void {
  writeJson(PUMP_TYPES_KEY, pumpTypes);
}

/** Scenario salvato, ripulito dalle voci non più previste dal modello dati. */
function normalizeSavedScenario(scenario: SavedScenario): SavedScenario {
  return {
    ...scenario,
    // Il vascone non è più una macchina: gli scenari salvati prima restano
    // validi con le sole motopompe (il pelo libero lo dichiara la pompa che vi
    // aspira, dal suo modo "asp.").
    equipment: (scenario.equipment || [])
      .filter(e => e.kind === 'pump')
      .map(e => ({ ...e, kind: 'pump' as const }))
  };
}

/** Scenari salvati dall'operatore, dal più recente al più vecchio. */
export function loadSavedScenarios(): SavedScenario[] {
  const stored = readJson<SavedScenario[]>(SAVED_SCENARIOS_KEY, []);
  return Array.isArray(stored) ? stored.map(normalizeSavedScenario) : [];
}

export function saveSavedScenarios(scenarios: SavedScenario[]): void {
  writeJson(SAVED_SCENARIOS_KEY, scenarios);
}
