import {
  ProjectConfig,
  StationNode,
  CalculatedPoint,
  CalculationResult,
  HydraulicAlert,
  SmartAdvisory,
  CalculationSummary
} from '../types';
import { findPumpType, calculatePumpDeliveryPressure } from './pumpCatalogue';
import { calculateHoseStretches, countHoses, nodeDiameterMm } from './hoseCount';

export const BAR_TO_METERS = 10.19716; // 1 bar ≈ 10.197 m colonna d'acqua
export const METERS_TO_BAR = 1 / BAR_TO_METERS; // ≈ 0.0980665 bar/m

/**
 * Calcola la perdita di carico unitaria J [m/m] secondo la formula di Hazen-Williams
 */
export function calculateHazenWilliamsUnitLoss(flowLpm: number, diameterMm: number, C: number): number {
  if (flowLpm <= 0 || diameterMm <= 0 || C <= 0) return 0;
  const Q = flowLpm / 60000; // m³/s
  const D = diameterMm / 1000; // m
  const numerator = 10.67 * Math.pow(Q, 1.852);
  const denominator = Math.pow(C, 1.852) * Math.pow(D, 4.87);
  return numerator / denominator;
}

/**
 * Calcola la velocità del fluido nella condotta [m/s]
 */
export function calculateFlowVelocity(flowLpm: number, diameterMm: number): number {
  if (flowLpm <= 0 || diameterMm <= 0) return 0;
  const Q = flowLpm / 60000; // m³/s
  const D = diameterMm / 1000; // m
  const area = (Math.PI * Math.pow(D, 2)) / 4;
  return Q / area;
}

/**
 * Motore di calcolo idraulico e verifica di fattibilità della condotta
 */
export function calculateHydraulicProfile(
  nodes: StationNode[],
  config: ProjectConfig
): CalculationResult {
  if (!nodes || nodes.length === 0) {
    return {
      points: [],
      alerts: [],
      advisories: [],
      summary: {
        totalDistanceM: 0,
        elevationDeltaM: 0,
        startElevationM: 0,
        endElevationM: 0,
        endPressureBar: 0,
        isFeasible: true,
        maxPressureBar: 0,
        minPressureBar: 0,
        hosesCount: 0,
        pumpsCount: 0
      },
      flowVelocityMs: 0,
      unitLossJ: 0
    };
  }

  // Ordina i nodi per progressiva di distanza reale crescente
  const sortedNodes = [...nodes].sort((a, b) => a.distanceM - b.distanceM);

  const points: CalculatedPoint[] = [];
  const alerts: HydraulicAlert[] = [];
  const advisories: SmartAdvisory[] = [];

  const localizedLossFactor = 1 + Math.max(0, config.localizedLossPercent) / 100;

  let currentPiezometricH = sortedNodes[0].elevationZ;
  let cumulativeLossM = 0;
  let prevNode: StationNode | null = null;

  let pumpsCount = 0;
  let isFeasible = true;

  // Analisi del primo nodo (Sorgente / Presa d'acqua)
  const firstNode = sortedNodes[0];
  let initialInletPressure = 0;
  let initialOutletPressure = config.sourcePressureBar;
  let initialPumpBoost: number | undefined = undefined;
  let isFirstPumpOverloaded = false;
  /** Pelo libero alla partenza, solo se si parte con motopompa in aspirazione. */
  let initialFreeSurfaceM: number | undefined = undefined;

  if (firstNode.type === 'pump' && firstNode.pumpConfig) {
    pumpsCount++;
    const pumpType = findPumpType(firstNode.pumpConfig.pumpTypeId, config.pumpTypes);
    const pumpOp = calculatePumpDeliveryPressure(
      pumpType,
      config.targetFlowLpm,
      firstNode.pumpConfig.regulatedBoostBar
    );

    firstNode.pumpConfig.maxAvailableBoostBar = pumpOp.maxCurvePressureBar;
    firstNode.pumpConfig.effectiveBoostBar = pumpOp.effectiveBoostBar;
    firstNode.pumpConfig.isOverloaded = pumpOp.isOverloaded;
    initialPumpBoost = pumpOp.effectiveBoostBar;

    if (pumpOp.isOverloaded) {
      isFirstPumpOverloaded = true;
      isFeasible = false;
      alerts.push({
        id: `alert-overload-${firstNode.id}`,
        type: 'danger',
        stationM: firstNode.distanceM,
        title: 'Sovraccarico Motopompa di Partenza',
        message: `La portata richiesta (${config.targetFlowLpm} l/min) supera la portata massima erogabile (${pumpOp.maxFlowLpm} l/min) della ${pumpType.name}. Rischio stallo motore.`
      });
    } else if (pumpOp.isOverNominal) {
      alerts.push({
        id: `alert-overnom-${firstNode.id}`,
        type: 'warning',
        stationM: firstNode.distanceM,
        title: 'Portata Superiore alla Nominale',
        message: `La portata richiesta (${config.targetFlowLpm} l/min) supera la nominale (${pumpType.nominalFlowLpm} l/min). La pressione di mandata cala a ${pumpOp.effectiveBoostBar.toFixed(2)} bar.`
      });
    }

    if (firstNode.pumpConfig.mode === 'vascone_suction') {
      const suctionLift = firstNode.pumpConfig.suctionLiftM || 0;
      if (suctionLift > 6.0) {
        alerts.push({
          id: `alert-suction-${firstNode.id}`,
          type: 'danger',
          stationM: firstNode.distanceM,
          title: 'Aspirazione Impossibile (Cavitazione)',
          message: `Altezza di aspirazione ${suctionLift.toFixed(1)} m > 6.0 m ammissibili. Mancato adescamento.`
        });
        isFeasible = false;
      }
      const freeSurfaceMStart = firstNode.elevationZ - suctionLift;
      currentPiezometricH = freeSurfaceMStart + pumpOp.effectiveBoostBar * BAR_TO_METERS;
      initialOutletPressure = (pumpOp.effectiveBoostBar * BAR_TO_METERS - suctionLift) * METERS_TO_BAR;
      initialInletPressure = 0;
      initialFreeSurfaceM = freeSurfaceMStart;
    } else {
      initialInletPressure = config.sourcePressureBar;
      initialOutletPressure = initialInletPressure + pumpOp.effectiveBoostBar;
      currentPiezometricH = firstNode.elevationZ + initialOutletPressure * BAR_TO_METERS;
    }
  } else {
    initialInletPressure = config.sourcePressureBar;
    initialOutletPressure = config.sourcePressureBar;
    currentPiezometricH = firstNode.elevationZ + config.sourcePressureBar * BAR_TO_METERS;
  }

  const initialStatus = isFirstPumpOverloaded
    ? 'danger'
    : initialOutletPressure < config.minLinePressureBar
    ? 'warning'
    : 'ok';

  points.push({
    index: 0,
    node: firstNode,
    distanceM: firstNode.distanceM,
    elevationZ: firstNode.elevationZ,
    segmentLossM: 0,
    cumulativeLossM: 0,
    hydraulicGradeH: currentPiezometricH,
    inletPressureBar: initialInletPressure,
    outletPressureBar: initialOutletPressure,
    pressureBar: initialOutletPressure,
    status: initialStatus,
    freeSurfaceM: initialFreeSurfaceM,
    pumpBoostBar: initialPumpBoost,
    isPumpOverloaded: isFirstPumpOverloaded,
    statusMessage: firstNode.type === 'pump'
      ? `Partenza con Pompa (Mandata: ${initialOutletPressure.toFixed(2)} bar)`
      : `Presa d'acqua sorgente (${config.sourcePressureBar.toFixed(2)} bar)`
  });

  prevNode = firstNode;

  // Itera sui nodi successivi
  for (let i = 1; i < sortedNodes.length; i++) {
    const node = sortedNodes[i];
    const deltaL = Math.max(0, node.distanceM - prevNode.distanceM);

    const diameter = nodeDiameterMm(node, config);
    const unitLoss = calculateHazenWilliamsUnitLoss(config.targetFlowLpm, diameter, config.hazenWilliamsC);
    const segmentLoss = unitLoss * deltaL * localizedLossFactor;

    cumulativeLossM += segmentLoss;
    // Calcolo piezometrica all'ingresso del nodo (prima dell'eventuale pompa)
    const piezometricAtInlet = currentPiezometricH - segmentLoss;
    const inletPressureBar = (piezometricAtInlet - node.elevationZ) * METERS_TO_BAR;

    let outletPressureBar = inletPressureBar;
    let pointStatus: 'ok' | 'warning' | 'danger' = 'ok';
    let statusMsg = '';
    let pumpBoost: number | undefined = undefined;
    let isPumpOverloaded = false;
    /** Quota del pelo libero, solo sulla bocca di una pompa in aspirazione. */
    let freeSurfaceM: number | undefined = undefined;

    // Controllo pressione all'ingresso prima del nodo.
    // Eccezione: la bocca di una motopompa che pesca a pelo libero è in
    // depressione per definizione (è la prevalenza di aspirazione a crearla):
    // non è un collasso della condotta. Per queste stazioni il criterio è
    // l'altezza di aspirazione H_asp, verificata più sotto.
    const isSuctionPump = node.type === 'pump' && node.pumpConfig?.mode === 'vascone_suction';

    if (!isSuctionPump) {
      if (inletPressureBar < 0) {
        pointStatus = 'danger';
        statusMsg = `Pressione negativa (${inletPressureBar.toFixed(2)} bar): collasso manichetta!`;
        isFeasible = false;
        alerts.push({
          id: `alert-negative-${node.id}`,
          type: 'danger',
          stationM: node.distanceM,
          title: 'Depressione / Collasso Tubo',
          message: `Alla progressiva ${node.distanceM} m la pressione scende a ${inletPressureBar.toFixed(2)} bar. Il flusso collassa.`
        });
      } else if (inletPressureBar < config.minLinePressureBar) {
        pointStatus = 'warning';
        statusMsg = `Pressione in ingresso bassa (${inletPressureBar.toFixed(2)} bar < ${config.minLinePressureBar} bar).`;
      }

      if (inletPressureBar > config.maxLinePressureBar) {
        pointStatus = 'danger';
        statusMsg = `Sovrapressione (${inletPressureBar.toFixed(2)} bar > ${config.maxLinePressureBar} bar): rischio scoppio!`;
        isFeasible = false;
        alerts.push({
          id: `alert-burst-${node.id}`,
          type: 'danger',
          stationM: node.distanceM,
          title: 'Rischio Scoppio Manichetta',
          message: `Alla progressiva ${node.distanceM} m la pressione raggiunge ${inletPressureBar.toFixed(2)} bar superando la soglia massima (${config.maxLinePressureBar} bar).`
        });
      }
    }

    // Gestione tipologia di nodo
    if (node.type === 'pump' && node.pumpConfig) {
      pumpsCount++;
      const pumpType = findPumpType(node.pumpConfig.pumpTypeId, config.pumpTypes);
      const pumpOp = calculatePumpDeliveryPressure(
        pumpType,
        config.targetFlowLpm,
        node.pumpConfig.regulatedBoostBar
      );

      node.pumpConfig.maxAvailableBoostBar = pumpOp.maxCurvePressureBar;
      node.pumpConfig.effectiveBoostBar = pumpOp.effectiveBoostBar;
      node.pumpConfig.isOverloaded = pumpOp.isOverloaded;
      pumpBoost = pumpOp.effectiveBoostBar;

      if (pumpOp.isOverloaded) {
        isPumpOverloaded = true;
        isFeasible = false;
        pointStatus = 'danger';
        alerts.push({
          id: `alert-pump-overload-${node.id}`,
          type: 'danger',
          stationM: node.distanceM,
          title: `Sovraccarico Motopompa (${node.distanceM} m)`,
          message: `La portata richiesta ${config.targetFlowLpm} l/min supera la portata massima ammissibile (${pumpOp.maxFlowLpm} l/min) per la motopompa ${pumpType.name}.`
        });
      } else if (pumpOp.isOverNominal) {
        alerts.push({
          id: `alert-pump-overnom-${node.id}`,
          type: 'warning',
          stationM: node.distanceM,
          title: `Portata Oltre Targa (${node.distanceM} m)`,
          message: `Motopompa ${pumpType.name}: portata ${config.targetFlowLpm} l/min > nominale ${pumpType.nominalFlowLpm} l/min. Pressione erogata calcolata da curva: ${pumpOp.effectiveBoostBar.toFixed(2)} bar.`
        });
      }

      if (node.pumpConfig.mode === 'vascone_suction') {
        const suctionLift = node.pumpConfig.suctionLiftM || 0;
        if (suctionLift > 6.0) {
          alerts.push({
            id: `alert-suction-${node.id}`,
            type: 'danger',
            stationM: node.distanceM,
            title: 'Aspirazione Impossibile (Cavitazione)',
            message: `Altezza di aspirazione ${suctionLift.toFixed(1)} m > 6.0 m. Mancato adescamento.`
          });
          pointStatus = 'danger';
          isFeasible = false;
        } else if (suctionLift > 4.5) {
          alerts.push({
            id: `alert-suction-warn-${node.id}`,
            type: 'warning',
            stationM: node.distanceM,
            title: 'Aspirazione Elevata',
            message: `Altezza di aspirazione ${suctionLift.toFixed(1)} m vicina al limite.`
          });
        }

        // Il pelo libero è sotto l'asse della pompa di H_asp: è lì che la
        // condotta a monte scarica (P = 0) e da lì la motopompa riparte.
        freeSurfaceM = node.elevationZ - suctionLift;

        // La condotta a monte deve comunque consegnare acqua alla vasca: se vi
        // arriva con pressione quasi nulla, la stazione prima è al limite.
        if (inletPressureBar < 0.2) {
          alerts.push({
            id: `alert-suction-feed-${node.id}`,
            type: 'warning',
            stationM: node.distanceM,
            title: 'Alimentazione del Pelo Libero Debole',
            message: `Alla progressiva ${node.distanceM} m la condotta arriva al pelo libero con pressione quasi nulla (${inletPressureBar.toFixed(2)} bar): la stazione a monte è al limite della propria prevalenza.`
          });
        }

        currentPiezometricH = freeSurfaceM + pumpOp.effectiveBoostBar * BAR_TO_METERS;
        outletPressureBar = (pumpOp.effectiveBoostBar * BAR_TO_METERS - suctionLift) * METERS_TO_BAR;

        if (outletPressureBar > config.maxLinePressureBar) {
          alerts.push({
            id: `alert-burst-pump-${node.id}`,
            type: 'danger',
            stationM: node.distanceM,
            title: 'Pressione di Mandata Eccessiva',
            message: `La motopompa eroga ${outletPressureBar.toFixed(2)} bar alla mandata, superando il limite (${config.maxLinePressureBar} bar).`
          });
          pointStatus = 'danger';
          isFeasible = false;
        }

        points.push({
          index: i,
          node,
          distanceM: node.distanceM,
          elevationZ: node.elevationZ,
          segmentLossM: segmentLoss,
          cumulativeLossM,
          hydraulicGradeH: currentPiezometricH,
          inletPressureBar,
          outletPressureBar,
          pressureBar: outletPressureBar,
          status: pointStatus,
          statusMessage: `Pompa ${pumpType.name} (Asp. ${suctionLift}m, Curva: +${pumpOp.effectiveBoostBar.toFixed(2)} bar)`,
          pumpBoostBar: pumpOp.effectiveBoostBar,
          isPumpOverloaded,
          freeSurfaceM
        });
      } else {
        // Pompa in diretta (Staffetta in pressione)
        if (inletPressureBar < 1.0) {
          alerts.push({
            id: `alert-inlet-low-${node.id}`,
            type: 'warning',
            stationM: node.distanceM,
            title: 'Pressione di Alimentazione Bassa',
            message: `La motopompa a ${node.distanceM} m riceve solo ${inletPressureBar.toFixed(2)} bar in aspirazione. Rischio schiacciamento manichetta monte.`
          });
          if (inletPressureBar <= 0) {
            pointStatus = 'danger';
            isFeasible = false;
          } else if (pointStatus === 'ok') {
            pointStatus = 'warning';
          }
        }

        outletPressureBar = inletPressureBar + pumpOp.effectiveBoostBar;
        currentPiezometricH = piezometricAtInlet + pumpOp.effectiveBoostBar * BAR_TO_METERS;

        if (outletPressureBar > config.maxLinePressureBar) {
          alerts.push({
            id: `alert-burst-pump-${node.id}`,
            type: 'danger',
            stationM: node.distanceM,
            title: 'Pressione Mandata Troppo Alta',
            message: `Mandata a ${outletPressureBar.toFixed(2)} bar (> ${config.maxLinePressureBar} bar limite). Rischio scoppio.`
          });
          pointStatus = 'danger';
          isFeasible = false;
        }

        points.push({
          index: i,
          node,
          distanceM: node.distanceM,
          elevationZ: node.elevationZ,
          segmentLossM: segmentLoss,
          cumulativeLossM,
          hydraulicGradeH: currentPiezometricH,
          inletPressureBar,
          outletPressureBar,
          pressureBar: outletPressureBar,
          status: pointStatus,
          statusMessage: `Pompa ${pumpType.name} (In: ${inletPressureBar.toFixed(2)} bar, Out: ${outletPressureBar.toFixed(2)} bar)`,
          pumpBoostBar: pumpOp.effectiveBoostBar,
          isPumpOverloaded
        });
      }
    } else {
      // Condotta semplice o terminale
      currentPiezometricH = piezometricAtInlet;
      outletPressureBar = inletPressureBar;

      if (node.type === 'end') {
        if (outletPressureBar < config.requiredEndPressureBar) {
          alerts.push({
            id: `alert-end-pressure-${node.id}`,
            type: 'danger',
            stationM: node.distanceM,
            title: 'Pressione Finale Insufficiente',
            message: `Al terminale arrivano ${outletPressureBar.toFixed(2)} bar (< ${config.requiredEndPressureBar} bar richiesti per la lancia).`
          });
          pointStatus = 'danger';
          isFeasible = false;
        }
      }

      points.push({
        index: i,
        node,
        distanceM: node.distanceM,
        elevationZ: node.elevationZ,
        segmentLossM: segmentLoss,
        cumulativeLossM,
        hydraulicGradeH: currentPiezometricH,
        inletPressureBar,
        outletPressureBar,
        pressureBar: outletPressureBar,
        status: pointStatus,
        statusMessage: statusMsg
      });
    }

    prevNode = node;
  }

  // Motore dei Consigli ("Smart Advisories")
  for (let k = 0; k < points.length - 1; k++) {
    const pt = points[k];
    const nextPt = points[k + 1];

    if (pt.outletPressureBar <= 1.8 && pt.node.type !== 'pump' && pt.node.type !== 'end') {
      const windowStart = Math.max(0, pt.distanceM - 50);
      const windowEnd = nextPt.distanceM;

      const hasCloseAdvisory = advisories.some(
        adv => Math.abs(adv.stationM - pt.distanceM) < 80
      );

      if (!hasCloseAdvisory) {
        advisories.push({
          id: `adv-pump-needed-${k}`,
          type: 'pump_recommended',
          stationM: pt.distanceM,
          rangeStartM: windowStart,
          rangeEndM: windowEnd,
          title: 'Posizione Consigliata per Motopompa di Rilancio',
          description: `La pressione residua scende a ${pt.outletPressureBar.toFixed(2)} bar alla progressiva ${pt.distanceM} m (quota ${pt.elevationZ} m).`,
          actionHint: `Si suggerisce di posizionare una motopompa tra le progressive ${windowStart.toFixed(0)} m e ${windowEnd.toFixed(0)} m.`
        });
      }
    }
  }

  const totalDistance = sortedNodes[sortedNodes.length - 1].distanceM;
  const elevationDelta = sortedNodes[sortedNodes.length - 1].elevationZ - sortedNodes[0].elevationZ;
  const endPressure = points[points.length - 1]?.outletPressureBar || 0;

  // La pressione minima/massima riguarda la condotta in pressione: si esclude
  // il lato in aspirazione delle motopompe che pescano a pelo libero (è in
  // depressione per progetto, non è un collasso della manichetta).
  const allPressures = points.flatMap(p => {
    if (p.node.type === 'pump' && p.node.pumpConfig?.mode === 'vascone_suction') {
      return [p.outletPressureBar];
    }
    return [p.inletPressureBar, p.outletPressureBar];
  });
  const maxPressure = Math.max(...allPressures);
  const minPressure = Math.min(...allPressures);

  // Le manichette si contano tratto per tratto, fra due macchine: uno spezzone
  // non si può dividere, quindi ogni tratto va arrotondato per eccesso e solo
  // dopo sommato. Il computo è condiviso con il Report Condotta
  // (calculateHoseStretches), così i due numeri non possono divergere.
  const hosesCount = countHoses(calculateHoseStretches(points, config));

  const mainDiameter = config.defaultDiameterMm;
  const flowVelocity = calculateFlowVelocity(config.targetFlowLpm, mainDiameter);
  const unitLossGlobal = calculateHazenWilliamsUnitLoss(config.targetFlowLpm, mainDiameter, config.hazenWilliamsC);

  const summary: CalculationSummary = {
    totalDistanceM: totalDistance,
    elevationDeltaM: elevationDelta,
    startElevationM: sortedNodes[0].elevationZ,
    endElevationM: sortedNodes[sortedNodes.length - 1].elevationZ,
    endPressureBar: endPressure,
    isFeasible: isFeasible && endPressure >= config.requiredEndPressureBar,
    maxPressureBar: maxPressure,
    minPressureBar: minPressure,
    hosesCount,
    pumpsCount
  };

  return {
    points,
    alerts,
    advisories,
    summary,
    flowVelocityMs: flowVelocity,
    unitLossJ: unitLossGlobal
  };
}
