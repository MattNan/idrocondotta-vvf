export interface PumpType {
  id: string;
  name: string;
  nominalFlowLpm: number; // l/min (Q_N)
  nominalHeadBar: number; // bar (P_N)
  shutoffPressureBar?: number; // bar a portata zero (P_0), default ~1.30 * P_N
  maxFlowLpm?: number; // l/min limite sovraccarico (Q_max), default ~1.35 * Q_N
  isBuiltin?: boolean;
  /** Modello mostrato in cima ai menù di scelta ("Pompe preferite"). */
  isFavorite?: boolean;
  description?: string;
}

/**
 * Tipo di nodo lungo la condotta. Il pelo libero non è un nodo a sé: la
 * partenza in aspirazione e la bocca di una motopompa che aspira da vascone lo
 * dichiarano da sé (vedi `PumpStationConfig.mode`).
 */
export type StationNodeType = 'start' | 'pipe' | 'pump' | 'end';

export interface PumpStationConfig {
  pumpTypeId: string;
  /**
   * Staffetta diretta in pressione oppure aspirazione da pelo libero (vascone,
   * fiume, vasca): è la macchina stessa a dire che lì c'è un pelo libero.
   * Il valore storico resta `vascone_suction` per non invalidare gli scenari
   * già salvati sui dispositivi.
   */
  mode: 'direct' | 'vascone_suction';
  suctionLiftM?: number; // Altezza geometrica di aspirazione (m tra pelo libero e asse pompa)
  regulatedBoostBar?: number; // Pressione regolata dall'operatore (0 <= P <= max curva)
  maxAvailableBoostBar?: number; // Pressione massima erogabile da curva alla portata attuale
  effectiveBoostBar?: number; // Pressione effettiva erogata usata nei calcoli [bar]
  isOverloaded?: boolean; // True se Q > Q_max
}

export interface StationNode {
  id: string;
  distanceM: number; // Lunghezza reale / diagonale sviluppata della condotta [m]
  elevationZ: number; // Quota altimetrica [m s.l.m.]
  type: StationNodeType;
  pumpConfig?: PumpStationConfig;
  pipeDiameterMm?: number; // Se specificato, sovrascrive il diametro globale (es. 70 o 45)
  notes?: string;
  /** Coordinate geografiche: presenti solo sui nodi derivati dal rilevamento GPS. */
  latitude?: number;
  longitude?: number;
}

/**
 * Geometria del tracciato: solo posizione plano-altimetrica.
 * Il primo punto è la partenza, l'ultimo l'arrivo.
 */
export interface ProfilePoint {
  id: string;
  distanceM: number; // Lunghezza reale / diagonale sviluppata [m]
  elevationZ: number; // Quota altimetrica [m s.l.m.]
  /** Coordinate geografiche: presenti solo se il punto arriva dal rilevamento GPS. */
  latitude?: number;
  longitude?: number;
}

/** Tipologia di macchina installata sul tracciato: solo motopompe. */
export type EquipmentKind = 'pump';

/**
 * Dotazione idraulica: le motopompe posizionate sul profilo.
 * La quota Z non è memorizzata: si interpola dal profilo in fase di calcolo.
 * Il pelo libero di aspirazione è dichiarato dalla motopompa stessa.
 */
export interface EquipmentItem {
  id: string;
  distanceM: number; // Progressiva sul tracciato [m]
  kind: EquipmentKind;
  pumpConfig?: PumpStationConfig;
  notes?: string;
}

/**
 * Punto del percorso GPS a piena risoluzione (tutti i punti registrati, non solo
 * quelli semplificati del profilo). Serve a vedere il tracciato in mappa e a
 * ritrovare la geografia esatta esportando il CSV.
 */
export interface GpsTrackPoint {
  distanceM: number; // Progressiva reale [m]
  elevationZ: number; // Quota GPS [m s.l.m.]
  latitude: number;
  longitude: number;
}

/**
 * Esito della modalità "Live GPS sul campo": i nodi rilevati più le
 * impostazioni di partenza scelte dall'operatore (portata e sorgente).
 */
export interface GpsTrackPayload {
  nodes: StationNode[];
  /** Portata scelta sul campo [l/min]; se assente si mantiene quella di progetto. */
  targetFlowLpm?: number;
  /** Pressione disponibile alla partenza [bar]; assente se si aspira da pelo libero. */
  sourcePressureBar?: number;
  /** Percorso rilevato a piena risoluzione, con latitudine e longitudine. */
  track?: GpsTrackPoint[];
}

export interface ProjectConfig {
  targetFlowLpm: number; // Portata richiesta di progetto [l/min] (200 - 1200)
  defaultDiameterMm: number; // 70 o 45
  hazenWilliamsC: number; // Scabrezza C (default 140)
  localizedLossPercent: number; // % perdite concentrate (curve, raccordi) (default 10)
  sourcePressureBar: number; // Pressione al punto di partenza (bar)
  sourcePumpConfig?: PumpStationConfig;
  minLinePressureBar: number; // Soglia minima per evitare collasso/cavitazione (default 1.0)
  maxLinePressureBar: number; // Pressione max ammissibile manichetta (default 12.0 o 14.0)
  requiredEndPressureBar: number; // Pressione richiesta al punto terminale / lancia (default 3.0)
  hoseSectionLengthM: number; // Lunghezza spezzoni manichetta (default 20 m)
  /**
   * Catalogo motopompe in uso: unico elenco (non c'è più distinzione tra
   * modelli predefiniti e personalizzati), tutti modificabili ed eliminabili.
   * Se vuoto si ricade sui modelli predefiniti.
   */
  pumpTypes: PumpType[];
}

/**
 * Scenario salvato in fretta dal campo: configurazione idraulica + geometria
 * (profilo e dotazione) + eventuale percorso GPS con le coordinate.
 */
export interface SavedScenario {
  id: string;
  name: string;
  createdAt: number;
  config: ProjectConfig;
  profile: ProfilePoint[];
  equipment: EquipmentItem[];
  track?: GpsTrackPoint[];
}

export interface CalculatedPoint {
  index: number;
  node: StationNode;
  distanceM: number; // Lunghezza reale condotta [m]
  elevationZ: number; // Quota altimetrica [m]
  segmentLossM: number;
  cumulativeLossM: number;
  hydraulicGradeH: number; // Quota piezometrica in uscita dal nodo [m]
  inletPressureBar: number; // Pressione prima del nodo / all'arrivo [bar]
  outletPressureBar: number; // Pressione dopo il nodo / alla partenza verso valle [bar]
  pressureBar: number; // Pressione rappresentativa per verifiche [bar]
  status: 'ok' | 'warning' | 'danger';
  statusMessage?: string;
  pumpBoostBar?: number;
  isPumpOverloaded?: boolean;
  /**
   * Quota del pelo libero di aspirazione [m s.l.m.] (Z dell'asse pompa meno
   * l'altezza di aspirazione), presente solo sulle motopompe in aspirazione.
   * È il punto in cui la piezometrica scende a P = 0 e riparte la spinta.
   */
  freeSurfaceM?: number;
}

export interface HydraulicAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  stationM: number;
  title: string;
  message: string;
}

export interface SmartAdvisory {
  id: string;
  type: 'pump_recommended' | 'overpressure_warning' | 'suction_warning' | 'terminal_warning';
  stationM: number;
  rangeStartM?: number;
  rangeEndM?: number;
  title: string;
  description: string;
  actionHint: string;
}

export interface CalculationSummary {
  totalDistanceM: number; // Sviluppo reale totale [m]
  elevationDeltaM: number;
  startElevationM: number;
  endElevationM: number;
  endPressureBar: number;
  isFeasible: boolean;
  maxPressureBar: number;
  minPressureBar: number;
  hosesCount: number;
  pumpsCount: number;
}

export interface CalculationResult {
  points: CalculatedPoint[];
  alerts: HydraulicAlert[];
  advisories: SmartAdvisory[];
  summary: CalculationSummary;
  flowVelocityMs: number;
  unitLossJ: number;
}

/** Una motopompa che lavora nel tratto, con la sua prevalenza a progetto. */
export interface SystemCurvePump {
  stationM: number;
  name: string;
  /** Prevalenza fornita alla portata di progetto [bar]. */
  boostAtDesignBar: number;
  /** Prevalenza massima a bocca chiusa [bar] (curva al 100%). */
  shutoffPressureBar: number;
  /** Portata massima ammissibile dalla macchina [l/min]. */
  maxFlowLpm: number;
  /** Altezza di aspirazione [m] (0 per la pompa in diretta). */
  suctionLiftM: number;
  /** Mandata regolata dall'operatore (a valle della strozzatura). */
  isThrottled: boolean;
}

/** Un punto campionato delle due curve (impianto e pompe in serie). */
export interface SystemCurveSample {
  qLpm: number;
  /** Prevalenza richiesta dall'impianto [m]. */
  demandM: number;
  /** Prevalenza fornita dalle pompe in serie [m]. */
  supplyM: number;
}

/**
 * Un tratto di condotta fra due peli liberi (la partenza o la bocca di
 * aspirazione di una motopompa). È indipendente dagli altri: ha la sua curva di
 * impianto e il suo punto di lavoro.
 */
export interface SystemCurveSection {
  index: number;
  label: string;
  fromM: number;
  toM: number;
  isLastSection: boolean;
  pumps: SystemCurvePump[];
  /** Portata massima consentita dalle pompe del tratto [l/min], null se non ce ne sono. */
  pumpsMaxFlowLpm: number | null;
  /** Pressione all'origine (solo il primo tratto). */
  sourcePressureBar: number;
  /** Dislivello + pressione finale richiesta + aspirazioni [m]. */
  staticDemandM: number;
  /** Perdite distribuite e concentrate alla portata di progetto [m]. */
  frictionAtDesignM: number;
  demandAtDesignM: number;
  supplyAtDesignM: number;
  /** Margine a progetto ricostruito dalle curve [bar]. */
  marginAtDesignBar: number;
  /** Margine effettivo del motore idraulico a fine tratto [bar]. */
  engineMarginBar: number;
  /** Portata all'incrocio delle due curve [l/min]; null se non si incrociano. */
  operatingFlowLpm: number | null;
  /** Prevalenza richiesta all'incrocio [m]; null quando non c'è incrocio. */
  operatingHeadM: number | null;
  /** La portata stimata è limitata dalle pompe (Q_max), non dalla condotta. */
  isPumpLimited: boolean;
  /** A progetto la prevalenza fornita copre quella richiesta. */
  isCovered: boolean;
  /** Estremo superiore dell'asse portate del grafico [l/min]. */
  chartQMax: number;
  curve: SystemCurveSample[];
}

/** L'insieme delle curve dei tratti: la portata sostenibile è la più debole. */
export interface SystemCurve {
  sections: SystemCurveSection[];
  sustainableFlowLpm: number | null;
  limitingSectionIndex: number | null;
  /** true se la portata di progetto è coperta in ogni tratto. */
  isCovered: boolean;
}
