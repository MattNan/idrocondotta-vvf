import {
  CalculatedPoint,
  ProjectConfig,
  PumpType,
  SystemCurve,
  SystemCurvePump,
  SystemCurveSample,
  SystemCurveSection
} from '../types';
import { BAR_TO_METERS, METERS_TO_BAR } from './hydraulicEngine';
import { calculatePumpDeliveryPressure, findPumpType } from './pumpCatalogue';

/**
 * Curva di impianto contro curva delle pompe in serie.
 *
 * L'impianto viene letto nei tratti che il motore idraulico già distingue: ogni
 * pelo libero (la partenza e la bocca di una motopompa che aspira da vascone,
 * fiume o piscina) azzera la piezometrica e apre un tratto indipendente. Per
 * ogni tratto valgono due relazioni di portata:
 *
 *   richiesta H(Q) = H_statico + J(Q)         con J(Q) = J_design·(Q/Q_design)^1.852
 *   fornita   H(Q) = H_sorgente + Σ pompe(Q)  con la curva di ogni pompa
 *
 * H_statico raccoglie il dislivello fra il pelo libero di partenza e quello
 * d'arrivo, oppure, per l'ultimo tratto, la pressione richiesta alla lancia.
 * L'incrocio delle due è la portata che il tratto riesce a muovere; fra più
 * tratti la portata sostenibile è quella del tratto più debole.
 *
 * Entrambe le relazioni riusano le funzioni del motore idraulico
 * (calculateHazenWilliamsUnitLoss / calculatePumpDeliveryPressure), quindi alla
 * portata di progetto la differenza fornita−richiesta coincide ESATTAMENTE con
 * il margine del nodo calcolato in hydraulicEngine: la curva non può
 * contraddire la verifica puntuale.
 */

/** Esponente di Hazen-Williams: la perdita cresce come Q^1.852. */
const HW_EXPONENT = 1.852;
/** Punti campionati per ogni curva del grafico. */
const CURVE_STEPS = 44;
/** Tetto di ricerca della portata quando non sono le pompe a limitare. */
const MAX_SEARCH_LPM = 6000;
/** Passo con cui si arrotondano gli estremi del grafico [l/min]. */
const ROUND_STEP = 50;

interface PumpRef {
  type: PumpType;
  regulatedBoostBar?: number;
}

function roundUp(value: number, step = ROUND_STEP): number {
  return Math.ceil(value / step) * step;
}

/** Prevalenza complessiva delle pompe in serie alla portata indicata [bar]. */
function seriesBoostAt(refs: PumpRef[], flowLpm: number): number {
  return refs.reduce(
    (sum, ref) =>
      sum + calculatePumpDeliveryPressure(ref.type, flowLpm, ref.regulatedBoostBar).effectiveBoostBar,
    0
  );
}

/** Una motopompa che pesca a pelo libero: apre un tratto indipendente. */
function isSuctionPump(point: CalculatedPoint): boolean {
  return point.node.type === 'pump' && point.node.pumpConfig?.mode === 'vascone_suction';
}

export function calculateSystemCurve(points: CalculatedPoint[], config: ProjectConfig): SystemCurve {
  const sections: SystemCurveSection[] = [];

  if (!points || points.length === 0) {
    return { sections, sustainableFlowLpm: null, limitingSectionIndex: null, isCovered: false };
  }

  const designFlowLpm = config.targetFlowLpm;

  // Progressive in cui la piezometrica riparte da un pelo libero: la partenza
  // e la bocca di ogni motopompa che pesca a pelo libero. Non serve un nodo
  // "vascone": è la macchina a dichiarare che lì c'è una vasca, un fiume o una
  // piscina da cui aspirare.
  const resets: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    if (isSuctionPump(points[i])) resets.push(i);
  }

  for (let r = 0; r < resets.length; r++) {
    const startIdx = resets[r];
    const nextReset = resets[r + 1];

    // Il tratto va dalla partenza (o dal pelo libero) fino al pelo libero
    // successivo — compreso, perché la condotta deve arrivarci — oppure fino al
    // terminale. La motopompa che apre il tratto seguente appartiene al tratto
    // seguente: qui conta solo la portata che arriva alla vasca.
    const endIdx = nextReset === undefined ? points.length - 1 : nextReset;

    if (endIdx <= startIdx) continue;

    const startPoint = points[startIdx];
    const endPoint = points[endIdx];
    const isLastSection = endIdx === points.length - 1;

    const refs: PumpRef[] = [];
    const pumps: SystemCurvePump[] = [];

    for (let i = startIdx; i < endIdx; i++) {
      const pt = points[i];
      if (pt.node.type !== 'pump' || !pt.node.pumpConfig) continue;

      const pumpType = findPumpType(pt.node.pumpConfig.pumpTypeId, config.pumpTypes);
      const regulatedBoostBar = pt.node.pumpConfig.regulatedBoostBar;
      const operation = calculatePumpDeliveryPressure(pumpType, designFlowLpm, regulatedBoostBar);
      const suctionLiftM =
        pt.node.pumpConfig.mode === 'vascone_suction'
          ? pt.node.pumpConfig.suctionLiftM || 0
          : 0;

      refs.push({ type: pumpType, regulatedBoostBar });
      pumps.push({
        stationM: pt.distanceM,
        name: pumpType.name,
        boostAtDesignBar: operation.effectiveBoostBar,
        shutoffPressureBar: operation.shutoffPressureBar,
        maxFlowLpm: operation.maxFlowLpm,
        suctionLiftM,
        isThrottled: operation.isThrottled
      });
    }

    // Quota da cui muove il tratto: il pelo libero per una bocca in
    // aspirazione (asse pompa meno H_asp), altrimenti la quota di partenza.
    const startRefM = startPoint.freeSurfaceM ?? startPoint.elevationZ;

    // Quota da raggiungere: il pelo libero successivo, dove la condotta scarica
    // a P = 0, oppure il terminale con la pressione richiesta per la lancia.
    const endRefM = isLastSection
      ? endPoint.elevationZ + config.requiredEndPressureBar * BAR_TO_METERS
      : endPoint.freeSurfaceM ?? endPoint.elevationZ;

    // La pressione di partenza alimenta solo il primo tratto: dopo un pelo
    // libero non c'è alcun carico residuo da sfruttare.
    const sourcePressureBar = startIdx === 0 && !isSuctionPump(startPoint) ? config.sourcePressureBar : 0;

    const staticDemandM = endRefM - startRefM;

    let frictionAtDesignM = 0;
    for (let i = startIdx + 1; i <= endIdx; i++) frictionAtDesignM += points[i].segmentLossM;

    const frictionAt = (flowLpm: number) =>
      designFlowLpm > 0
        ? frictionAtDesignM * Math.pow(Math.max(0, flowLpm) / designFlowLpm, HW_EXPONENT)
        : frictionAtDesignM;
    const demandAt = (flowLpm: number) => staticDemandM + frictionAt(flowLpm);
    const supplyAt = (flowLpm: number) =>
      sourcePressureBar * BAR_TO_METERS + seriesBoostAt(refs, flowLpm) * BAR_TO_METERS;

    const pumpsMaxFlowLpm = pumps.length > 0 ? Math.min(...pumps.map(p => p.maxFlowLpm)) : null;
    const ceiling = pumpsMaxFlowLpm ?? MAX_SEARCH_LPM;
    const excess = (flowLpm: number) => supplyAt(flowLpm) - demandAt(flowLpm);

    let operatingFlowLpm: number | null;
    let isPumpLimited = false;

    if (excess(0) <= 0) {
      // Nemmeno a valvole chiuse le pompe coprono il dislivello: portata nulla.
      operatingFlowLpm = null;
    } else if (excess(ceiling) >= 0) {
      // Il vincolo è la macchina (Q_max), non la condotta.
      operatingFlowLpm = ceiling;
      isPumpLimited = pumpsMaxFlowLpm !== null;
    } else {
      let lo = 0;
      let hi = ceiling;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (excess(mid) > 0) lo = mid;
        else hi = mid;
      }
      operatingFlowLpm = (lo + hi) / 2;
    }

    const operatingHeadM = operatingFlowLpm === null ? null : demandAt(operatingFlowLpm);

    // Estremi del grafico: si vede sempre il punto di lavoro e la linea di
    // progetto, senza sbordare oltre quello che le pompe possono dare.
    const referenceFlow = Math.max(designFlowLpm * 1.25, (operatingFlowLpm ?? designFlowLpm) * 1.15, 200);
    let chartQMax = roundUp(referenceFlow);
    if (pumpsMaxFlowLpm !== null) {
      chartQMax = Math.min(chartQMax, Math.max(roundUp(pumpsMaxFlowLpm), roundUp(designFlowLpm * 1.1)));
    }

    const curve: SystemCurveSample[] = [];
    for (let k = 0; k <= CURVE_STEPS; k++) {
      const q = (chartQMax * k) / CURVE_STEPS;
      curve.push({ qLpm: Math.round(q), demandM: demandAt(q), supplyM: supplyAt(q) });
    }

    const demandAtDesignM = demandAt(designFlowLpm);
    const supplyAtDesignM = supplyAt(designFlowLpm);
    const marginAtDesignBar = (supplyAtDesignM - demandAtDesignM) * METERS_TO_BAR;

    // Margine del motore idraulico alla fine del tratto: allo stesso punto le
    // due letture devono coincidere (è la verifica di coerenza in __verify__).
    // All'arrivo nel pelo libero il margine è il carico che resta sopra la
    // superficie della vasca, quello che si dissipa scaricandovi.
    const arrivalHeadM = endPoint.elevationZ + endPoint.inletPressureBar * BAR_TO_METERS;
    const engineMarginBar = isLastSection
      ? endPoint.outletPressureBar - config.requiredEndPressureBar
      : (arrivalHeadM - endRefM) * METERS_TO_BAR;

    const fromLabel = isSuctionPump(startPoint) ? 'Aspirazione' : 'Partenza';
    const toLabel = isLastSection ? 'Terminale' : 'Aspirazione';

    sections.push({
      index: sections.length,
      label: fromLabel + ' ' + Math.round(startPoint.distanceM) + ' m → ' + toLabel + ' ' + Math.round(endPoint.distanceM) + ' m',
      fromM: startPoint.distanceM,
      toM: endPoint.distanceM,
      isLastSection,
      pumps,
      pumpsMaxFlowLpm,
      sourcePressureBar,
      staticDemandM,
      frictionAtDesignM,
      demandAtDesignM,
      supplyAtDesignM,
      marginAtDesignBar,
      engineMarginBar,
      operatingFlowLpm,
      operatingHeadM,
      isPumpLimited,
      isCovered: supplyAtDesignM >= demandAtDesignM,
      chartQMax,
      curve
    });
  }

  let limitingSectionIndex: number | null = sections.length > 0 ? 0 : null;
  const flowOf = (section: SystemCurveSection) => (section.operatingFlowLpm === null ? -1 : section.operatingFlowLpm);

  if (limitingSectionIndex !== null) {
    sections.forEach((section, i) => {
      if (flowOf(section) < flowOf(sections[limitingSectionIndex as number])) limitingSectionIndex = i;
    });
  }

  return {
    sections,
    sustainableFlowLpm: limitingSectionIndex === null ? null : sections[limitingSectionIndex].operatingFlowLpm,
    limitingSectionIndex,
    isCovered: sections.length > 0 && sections.every(section => section.isCovered)
  };
}
