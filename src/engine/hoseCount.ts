import { CalculatedPoint, ProjectConfig, StationNode } from '../types';

/**
 * Suddivisione della condotta in tratti di manichetta e computo degli spezzoni.
 *
 * Un tratto va **da una macchina alla successiva** — partenza, motopompa,
 * vascone, arrivo — oppure finisce dove cambia il diametro. Sono i soli punti
 * in cui la linea cambia davvero natura. I vertici intermedi del profilo
 * altimetrico (le spezzate del rilievo) non chiudono un tratto: se si spezzasse
 * lì, ogni pezzetto andrebbe arrotondato per eccesso per conto suo e il totale
 * si gonfierebbe (tre pezzi da 7 m diventano tre spezzoni invece di uno solo).
 *
 * Motore idraulico e Report Condotta usano questa stessa funzione, quindi il
 * numero stampato non può discostarsi da quello contato nella verifica.
 */

/** Un tratto di condotta fra due macchine (o due diametri). */
export interface HoseStretch {
  key: string;
  /** Indici in `points` dei nodi che delimitano il tratto (estremi inclusi). */
  fromIndex: number;
  toIndex: number;
  fromM: number;
  toM: number;
  lengthM: number;
  /** Diametro degli spezzoni del tratto [mm] (uniforme per costruzione). */
  diameterMm: number;
  /** Spezzoni necessari: uno spezzone non si divide, si arrotonda per eccesso. */
  hoses: number;
}

/** Diametro che governa un nodo: l'eventuale forzatura locale batte il globale. */
export function nodeDiameterMm(node: StationNode, config: ProjectConfig): number {
  return node.pipeDiameterMm || config.defaultDiameterMm;
}

/** Lunghezza dello spezzone in uso [m]. */
export function hoseSectionLengthM(config: ProjectConfig): number {
  return config.hoseSectionLengthM > 0 ? config.hoseSectionLengthM : 20;
}

/** Una macchina (o un capo della linea): non un semplice vertice del profilo. */
function isMachineBoundary(node: StationNode): boolean {
  return node.type !== 'pipe';
}

/**
 * Tratti di manichetta dal primo all'ultimo punto, nell'ordine della condotta.
 * Un tratto viene chiuso sul nodo `i` quando è l'arrivo, quando è una macchina
 * o quando il segmento successivo cambia diametro.
 */
export function calculateHoseStretches(
  points: CalculatedPoint[],
  config: ProjectConfig
): HoseStretch[] {
  const stretches: HoseStretch[] = [];
  if (!points || points.length < 2) return stretches;

  const hoseLen = hoseSectionLengthM(config);
  let fromIndex = 0;

  for (let i = 1; i < points.length; i++) {
    const isLastPoint = i === points.length - 1;
    const isMachine = isMachineBoundary(points[i].node);
    const diameterChangesAfter =
      !isLastPoint &&
      nodeDiameterMm(points[i + 1].node, config) !== nodeDiameterMm(points[i].node, config);

    if (!isLastPoint && !isMachine && !diameterChangesAfter) continue;

    const fromM = points[fromIndex].distanceM;
    const toM = points[i].distanceM;
    const lengthM = Math.max(0, toM - fromM);

    stretches.push({
      key: points[fromIndex].node.id + '->' + points[i].node.id,
      fromIndex,
      toIndex: i,
      fromM,
      toM,
      lengthM,
      diameterMm: nodeDiameterMm(points[i].node, config),
      hoses: lengthM > 0 ? Math.ceil(lengthM / hoseLen) : 0
    });

    fromIndex = i;
  }

  return stretches;
}

/** Totale degli spezzoni: somma dei tratti, ognuno già arrotondato per eccesso. */
export function countHoses(stretches: HoseStretch[]): number {
  return stretches.reduce((sum, stretch) => sum + stretch.hoses, 0);
}
