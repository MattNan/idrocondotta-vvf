import { PumpType } from '../types';

/**
 * Catalogo motopompe predefinito (ripristinabile con il pulsante "Ripristina").
 *
 * La sigla italiana "portata/pressione" indica la portata in centinaia di l/min
 * alla pressione nominale in bar (es. 8/8 = 800 l/min a 8 bar), la stessa
 * convenzione delle vecchie DIN 14420 / TS e delle EN 1028 (FPN / PFPN).
 *
 * I modelli con `isFavorite: true` compaiono in cima ai menù di scelta
 * ("Preferite"); lo stella è modificabile in "Gestisci Pompe".
 */
export const DEFAULT_PUMP_TYPES: PumpType[] = [
  {
    id: 'pump-8-8',
    name: 'Motopompa 8/8 (Portatile standard)',
    nominalFlowLpm: 800,
    nominalHeadBar: 8.0,
    shutoffPressureBar: 10.5,
    maxFlowLpm: 1080, // ~1.35 * 800 l/min
    isBuiltin: true,
    isFavorite: true,
    description: 'Classica motopompa portatile VVF / AIB (800 l/min a 8 bar). Pressione massima a saracinesca chiusa: 10.5 bar.'
  },
  {
    id: 'pump-10-8',
    name: 'Motopompa 10/8 (Portata media, 8 bar)',
    nominalFlowLpm: 1000,
    nominalHeadBar: 8.0,
    shutoffPressureBar: 10.5,
    maxFlowLpm: 1350,
    isBuiltin: true,
    isFavorite: true,
    description: 'Portatile da 1000 l/min a 8 bar: più acqua della 8/8 alla stessa pressione.'
  },
  {
    id: 'pump-12-8',
    name: 'Motopompa 12/8 (Alta portata, 8 bar)',
    nominalFlowLpm: 1200,
    nominalHeadBar: 8.0,
    shutoffPressureBar: 10.5,
    maxFlowLpm: 1620,
    isBuiltin: true,
    description: 'Alta portata a bassa pressione (1200 l/min a 8 bar) per alimentare più linee in parallelo.'
  },
  {
    id: 'pump-16-8',
    name: 'Motopompa 16/8 (Grande portata, 8 bar)',
    nominalFlowLpm: 1600,
    nominalHeadBar: 8.0,
    shutoffPressureBar: 10.5,
    maxFlowLpm: 2160,
    isBuiltin: true,
    description: 'Grande portata (1600 l/min a 8 bar), tipicamente su carrello o rimorchio.'
  },
  {
    id: 'pump-10-10',
    name: 'Motopompa 10/10 (PFPN 10-1000)',
    nominalFlowLpm: 1000,
    nominalHeadBar: 10.0,
    shutoffPressureBar: 13.0,
    maxFlowLpm: 1350,
    isBuiltin: true,
    description: 'Standard europeo EN 1028 (1000 l/min a 10 bar, tipo Fox / Magirus / Rosenbauer).'
  },
  {
    id: 'pump-12-10',
    name: 'Motopompa 12/10 (Media potenza)',
    nominalFlowLpm: 1200,
    nominalHeadBar: 10.0,
    shutoffPressureBar: 13.5,
    maxFlowLpm: 1600, // ~1.33 * 1200 l/min
    isBuiltin: true,
    isFavorite: true,
    description: 'Motopompa ad alta portata per rilanci principali o da APS (1200 l/min a 10 bar, max 13.5 bar).'
  },
  {
    id: 'pump-16-10',
    name: 'Motopompa 16/10 (Grande portata, 10 bar)',
    nominalFlowLpm: 1600,
    nominalHeadBar: 10.0,
    shutoffPressureBar: 13.5,
    maxFlowLpm: 2160,
    isBuiltin: true,
    description: 'Grande portata a 10 bar (1600 l/min): alimentazione di più linee o lunghe distanze.'
  },
  {
    id: 'pump-10-15',
    name: 'Motopompa 15/10 (PFPN 10-1500)',
    nominalFlowLpm: 1500,
    nominalHeadBar: 10.0,
    shutoffPressureBar: 14.0,
    maxFlowLpm: 1950,
    isBuiltin: true,
    description: 'Alta prestazione per alimentazione multipla (1500 l/min a 10 bar).'
  },
  {
    id: 'pump-12-12',
    name: 'Motopompa 12/12 (Alta pressione, 12 bar)',
    nominalFlowLpm: 1200,
    nominalHeadBar: 12.0,
    shutoffPressureBar: 15.5,
    maxFlowLpm: 1620,
    isBuiltin: true,
    description: '1200 l/min a 12 bar: utile su forti dislivelli con una sola stazione di rilancio.'
  },
  {
    id: 'pump-ts-2-5',
    name: 'Motopompa TS 2/5 (Portatile leggera)',
    nominalFlowLpm: 200,
    nominalHeadBar: 5.0,
    shutoffPressureBar: 6.5,
    maxFlowLpm: 320,
    isBuiltin: true,
    description: 'Portatile leggera (200 l/min a 5 bar): rilancio corto con manichetta da 45, trasporto a spalla.'
  },
  {
    id: 'pump-ts-4-5',
    name: 'Motopompa TS 4/5 (Portatile media)',
    nominalFlowLpm: 400,
    nominalHeadBar: 5.0,
    shutoffPressureBar: 6.5,
    maxFlowLpm: 640,
    isBuiltin: true,
    description: '400 l/min a 5 bar: rilancio leggero su tratti in piano o alimentazione di una linea da 45.'
  },
  {
    id: 'pump-fp-24-8',
    name: 'Motopompa FP 24/8 (Rimorchiabile)',
    nominalFlowLpm: 2400,
    nominalHeadBar: 8.0,
    shutoffPressureBar: 10.5,
    maxFlowLpm: 3240,
    isBuiltin: true,
    description: 'Grande portata rimorchiabile (2400 l/min a 8 bar) per l\'alimentazione di più linee in parallelo.'
  },
  {
    id: 'pump-fp-32-8',
    name: 'Motopompa FP 32/8 (Alta portata)',
    nominalFlowLpm: 3200,
    nominalHeadBar: 8.0,
    shutoffPressureBar: 10.5,
    maxFlowLpm: 4320,
    isBuiltin: true,
    description: 'Massima portata (3200 l/min a 8 bar) per grandi schieramenti e linee multiple.'
  },
  {
    id: 'pump-fpn-6-500',
    name: 'Motopompa FPN 6-500 (EN 1028)',
    nominalFlowLpm: 500,
    nominalHeadBar: 6.0,
    shutoffPressureBar: 8.0,
    maxFlowLpm: 800,
    isBuiltin: true,
    description: 'Classe europea EN 1028 FPN 6-500: 500 l/min a 6 bar, tipica pompa di primo impiego.'
  },
  {
    id: 'pump-fpn-10-750',
    name: 'Motopompa FPN 10-750 (EN 1028)',
    nominalFlowLpm: 750,
    nominalHeadBar: 10.0,
    shutoffPressureBar: 13.0,
    maxFlowLpm: 1050,
    isBuiltin: true,
    description: 'Classe EN 1028 FPN 10-750: 750 l/min a 10 bar, compromesso portata/prevalenza.'
  },
  {
    id: 'pump-fpn-15-1000',
    name: 'Motopompa FPN 15-1000 (EN 1028)',
    nominalFlowLpm: 1000,
    nominalHeadBar: 15.0,
    shutoffPressureBar: 19.5,
    maxFlowLpm: 1400,
    isBuiltin: true,
    description: 'Alta pressione EN 1028 FPN 15-1000: 1000 l/min a 15 bar per quote elevate e lunghe salite.'
  },
  {
    id: 'pump-fpn-10-3000',
    name: 'Motopompa FPN 10-3000 (EN 1028)',
    nominalFlowLpm: 3000,
    nominalHeadBar: 10.0,
    shutoffPressureBar: 13.0,
    maxFlowLpm: 4000,
    isBuiltin: true,
    description: 'Grande portata EN 1028 FPN 10-3000: 3000 l/min a 10 bar.'
  },
  {
    id: 'pump-pfpn-10-2000',
    name: 'Motopompa PFPN 10-2000 (EN 1028)',
    nominalFlowLpm: 2000,
    nominalHeadBar: 10.0,
    shutoffPressureBar: 13.0,
    maxFlowLpm: 2700,
    isBuiltin: true,
    description: 'Pompa portatile EN 1028 PFPN 10-2000: 2000 l/min a 10 bar.'
  },
  {
    id: 'pump-fpn-15-2000',
    name: 'Motopompa FPN 15-2000 (EN 1028)',
    nominalFlowLpm: 2000,
    nominalHeadBar: 15.0,
    shutoffPressureBar: 20.0,
    maxFlowLpm: 2700,
    isBuiltin: true,
    description: 'Alta pressione e grande portata EN 1028 FPN 15-2000: 2000 l/min a 15 bar.'
  },
  {
    id: 'pump-aib-hp',
    name: 'Motopompa AIB Alta Pressione (Wick / Mark-3)',
    nominalFlowLpm: 250,
    nominalHeadBar: 16.0,
    shutoffPressureBar: 21.0,
    maxFlowLpm: 380,
    isBuiltin: true,
    isFavorite: true,
    description: 'Pompa centrifuga multistadio da boschivo per forti pendenze (250 l/min a 16 bar, shut-off 21 bar).'
  },
  {
    id: 'pump-transfer',
    name: 'Pompa di travaso vasconi (bassa pressione)',
    nominalFlowLpm: 1000,
    nominalHeadBar: 3.5,
    shutoffPressureBar: 5.0,
    maxFlowLpm: 1400,
    isBuiltin: true,
    description: 'Pompa volumetrica o sentina per solo carico vasche a dislivello minimo.'
  }
];

/**
 * Catalogo effettivo in uso. Se il catalogo non è mai stato definito
 * (`undefined`) si usano i modelli predefiniti; se l'utente lo ha svuotato
 * di proposito resta vuoto (si ripristina dalla gestione pompe).
 */
export function getPumpCatalogue(pumpTypes?: PumpType[]): PumpType[] {
  return pumpTypes ?? DEFAULT_PUMP_TYPES;
}

export function findPumpType(id: string, pumpTypes?: PumpType[]): PumpType {
  const list = pumpTypes ?? DEFAULT_PUMP_TYPES;
  const found = list.find(p => p.id === id);
  if (found) return found;
  // Il motore non deve mai restare senza un modello: ricade sul primo predefinito.
  return list[0] ?? DEFAULT_PUMP_TYPES[0];
}

/** Etichetta breve e compatta di un modello, per i menù di scelta. */
export function pumpTypeLabel(p: PumpType): string {
  const short = p.name.split('(')[0].trim();
  return `${short} (${p.nominalHeadBar}b @ ${p.nominalFlowLpm} l/min)`;
}

/**
 * Sdoppia il catalogo per i menù di scelta: prima le "Pompe preferite"
 * (stelle dell'operatore), poi tutto il resto del catalogo. Ogni modello
 * compare una sola volta, così la voce selezionata resta univoca.
 */
export function splitCatalogue(pumpTypes?: PumpType[]): {
  favourites: PumpType[];
  others: PumpType[];
} {
  const list = getPumpCatalogue(pumpTypes);
  return {
    favourites: list.filter(p => p.isFavorite),
    others: list.filter(p => !p.isFavorite)
  };
}

export interface PumpOperatingPoint {
  maxCurvePressureBar: number; // Pressione massima erogabile da curva alla portata attuale
  effectiveBoostBar: number; // Pressione regolata (0 <= P <= maxCurvePressureBar)
  effectiveHeadM: number;
  isOverNominal: boolean;
  isOverloaded: boolean;
  shutoffPressureBar: number;
  maxFlowLpm: number;
  flowRatio: number; // Q / Q_N
  isThrottled: boolean; // True se l'operatore ha strozzato/ridotto la mandata rispetto al max di curva
}

/**
 * Calcola il punto di lavoro effettivo della pompa alla portata Q impostata,
 * consentendo la regolazione dell'acceleratore/mandata tra 0 e la pressione max da curva P(Q).
 */
export function calculatePumpDeliveryPressure(
  pump: PumpType,
  targetFlowLpm: number,
  regulatedBoostBar?: number
): PumpOperatingPoint {
  const Q_N = pump.nominalFlowLpm > 0 ? pump.nominalFlowLpm : 800;
  const P_N = pump.nominalHeadBar > 0 ? pump.nominalHeadBar : 8.0;
  const P_0 = pump.shutoffPressureBar && pump.shutoffPressureBar > P_N
    ? pump.shutoffPressureBar
    : P_N * 1.30;
  const Q_max = pump.maxFlowLpm && pump.maxFlowLpm > Q_N
    ? pump.maxFlowLpm
    : Math.round(Q_N * 1.35);

  const isOverNominal = targetFlowLpm > Q_N;
  const isOverloaded = targetFlowLpm > Q_max;

  // Calcolo pressione massima teorica da curva a questa portata
  const ratio = targetFlowLpm / Q_N;
  const deltaP = P_0 - (P_0 - P_N) * Math.pow(ratio, 2);
  const maxCurvePressureBar = isOverloaded ? 0 : Math.max(0, Number(deltaP.toFixed(2)));

  // Regolazione da 0 a maxCurvePressureBar
  let effectiveBoostBar = maxCurvePressureBar;
  let isThrottled = false;

  if (regulatedBoostBar !== undefined) {
    effectiveBoostBar = Math.max(0, Math.min(regulatedBoostBar, maxCurvePressureBar));
    effectiveBoostBar = Number(effectiveBoostBar.toFixed(2));
    isThrottled = effectiveBoostBar < maxCurvePressureBar - 0.05;
  }

  return {
    maxCurvePressureBar,
    effectiveBoostBar,
    effectiveHeadM: effectiveBoostBar * 10.197,
    isOverNominal,
    isOverloaded,
    shutoffPressureBar: P_0,
    maxFlowLpm: Q_max,
    flowRatio: ratio,
    isThrottled
  };
}

/**
 * Genera una serie di punti (Q, P) per tracciare la curva caratteristica
 */
export function generatePumpCurveData(pump: PumpType, steps = 30): Array<{ q: number; p: number }> {
  const Q_N = pump.nominalFlowLpm;
  const P_N = pump.nominalHeadBar;
  const P_0 = pump.shutoffPressureBar || P_N * 1.30;
  const Q_max = pump.maxFlowLpm || Math.round(Q_N * 1.35);

  const points: Array<{ q: number; p: number }> = [];
  const maxQSample = Math.round(Q_max * 1.15);
  const stepSize = maxQSample / steps;

  for (let q = 0; q <= maxQSample; q += stepSize) {
    const ratio = q / Q_N;
    const p = Math.max(0, P_0 - (P_0 - P_N) * Math.pow(ratio, 2));
    points.push({ q: Math.round(q), p: Number(p.toFixed(2)) });
  }

  return points;
}
