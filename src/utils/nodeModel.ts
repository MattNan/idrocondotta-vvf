import {
  StationNode,
  StationNodeType,
  ProfilePoint,
  EquipmentItem,
  PumpStationConfig
} from '../types';

/** Tolleranza [m] per considerare una macchina coincidente con un punto del profilo. */
const MATCH_TOL_M = 0.5;

export const DEFAULT_PUMP_CONFIG: PumpStationConfig = {
  pumpTypeId: 'pump-8-8',
  mode: 'direct'
};

/**
 * Interpola la quota del terreno Z alla progressiva richiesta, lungo la spezzata
 * definita dai punti profilo. Fuori dal tracciato restituisce la quota dell'estremo.
 */
export function interpolateZ(profile: ProfilePoint[], distanceM: number): number {
  const pts = [...profile].sort((a, b) => a.distanceM - b.distanceM);
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0].elevationZ;
  if (distanceM <= pts[0].distanceM) return pts[0].elevationZ;
  if (distanceM >= pts[pts.length - 1].distanceM) return pts[pts.length - 1].elevationZ;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (distanceM >= a.distanceM && distanceM <= b.distanceM) {
      const span = Math.max(1e-9, b.distanceM - a.distanceM);
      const t = (distanceM - a.distanceM) / span;
      return Math.round(a.elevationZ + t * (b.elevationZ - a.elevationZ));
    }
  }
  return pts[pts.length - 1].elevationZ;
}

/**
 * Separa un elenco di nodi (formato storico, geometria + dotazione mescolate)
 * in profilo plano-altimetrico e dotazione (motopompe).
 */
export function splitNodes(nodes: StationNode[]): {
  profile: ProfilePoint[];
  equipment: EquipmentItem[];
} {
  const sorted = [...nodes].sort((a, b) => a.distanceM - b.distanceM);

  const profile: ProfilePoint[] = sorted.map(n => ({
    id: n.id,
    distanceM: n.distanceM,
    elevationZ: n.elevationZ,
    ...(n.latitude !== undefined && n.longitude !== undefined
      ? { latitude: n.latitude, longitude: n.longitude }
      : {})
  }));

  const equipment: EquipmentItem[] = sorted
    .filter(n => n.type === 'pump')
    .map(n => ({
      id: n.id,
      distanceM: n.distanceM,
      kind: 'pump' as const,
      pumpConfig: n.pumpConfig ? { ...n.pumpConfig } : undefined,
      notes: n.notes
    }));

  return { profile, equipment };
}

/**
 * Dati di partenza scelti dall'operatore nella modalità "Live GPS sul campo",
 * più i punti registrati e i marker marcati camminando.
 */
export interface TrackBuildInput {
  /** Punti GPS registrati, con distanze cumulative e coordinate geografiche. */
  recordedPoints: Array<{
    cumulativeDiagM: number;
    altitudeM: number;
    latitude?: number;
    longitude?: number;
  }>;
  /** Motopompe marcate con i pulsanti "sul posto". */
  fieldNodes: StationNode[];
  /** True se l'operatore vuole una motopompa al punto di partenza. */
  pumpAtStart: boolean;
  startPumpTypeId: string;
  sourceMode: 'pressure' | 'suction';
  sourcePressureBar: number;
  suctionLiftM: number;
}

/**
 * Converte il tracciato GPS registrato in nodi per il motore idraulico:
 * i punti diventano partenza / condotta / arrivo (uno ogni ~60 m), i marker
 * dell'operatore hanno la precedenza, e il primo punto rispetta la sorgente
 * scelta (pressione in mandata oppure aspirazione da pelo libero con pompa).
 */
export function buildTrackNodes(input: TrackBuildInput): StationNode[] {
  const {
    recordedPoints,
    fieldNodes,
    pumpAtStart,
    startPumpTypeId,
    sourceMode,
    sourcePressureBar,
    suctionLiftM
  } = input;

  const finalNodes: StationNode[] = [];
  const startNotes =
    sourceMode === 'suction'
      ? `Partenza con aspirazione da pelo libero ${suctionLiftM.toFixed(1)} m (GPS)`
      : `Partenza con pressione ${sourcePressureBar.toFixed(2)} bar (GPS)`;

  /** Coordinate geografiche del punto registrato, quando disponibili. */
  const geoOf = (pt: { latitude?: number; longitude?: number }) =>
    pt.latitude !== undefined && pt.longitude !== undefined
      ? { latitude: pt.latitude, longitude: pt.longitude }
      : {};

  let lastRecordedDist = -100;
  recordedPoints.forEach((pt, idx) => {
    const isStart = idx === 0;
    const isEnd = idx === recordedPoints.length - 1;
    const isStep = pt.cumulativeDiagM - lastRecordedDist >= 60;
    const geo = geoOf(pt);

    // Il marcatore dell'operatore ha la priorità sulla posizione registrata.
    const userMarker = fieldNodes.find(
      fn => Math.abs(fn.distanceM - pt.cumulativeDiagM) < 15
    );

    if (userMarker) {
      finalNodes.push({ ...userMarker, ...geo });
      lastRecordedDist = pt.cumulativeDiagM;
    } else if (isStart) {
      finalNodes.push(
        pumpAtStart
          ? {
              id: 'node-gps-0',
              distanceM: 0,
              elevationZ: Math.round(pt.altitudeM),
              type: 'pump',
              pumpConfig: {
                pumpTypeId: startPumpTypeId,
                mode: sourceMode === 'suction' ? 'vascone_suction' : 'direct',
                suctionLiftM: sourceMode === 'suction' ? suctionLiftM : undefined
              },
              notes: startNotes,
              ...geo
            }
          : {
              id: 'node-gps-0',
              distanceM: 0,
              elevationZ: Math.round(pt.altitudeM),
              type: 'start',
              notes: startNotes,
              ...geo
            }
      );
      lastRecordedDist = 0;
    } else if (isEnd) {
      finalNodes.push({
        id: 'node-gps-end',
        distanceM: Math.round(pt.cumulativeDiagM),
        elevationZ: Math.round(pt.altitudeM),
        type: 'end',
        notes: 'Terminale rilevato (GPS)',
        ...geo
      });
    } else if (isStep) {
      finalNodes.push({
        id: `node-gps-${idx}`,
        distanceM: Math.round(pt.cumulativeDiagM),
        elevationZ: Math.round(pt.altitudeM),
        type: 'pipe',
        ...geo
      });
      lastRecordedDist = pt.cumulativeDiagM;
    }
  });

  return finalNodes;
}

/**
 * Costruisce l'elenco dei nodi per il motore idraulico unendo:
 *  - i punti del profilo (che diventano partenza / condotta / arrivo);
 *  - le motopompe posizionate alla loro progressiva.
 *
 * Se una macchina non coincide con un punto del profilo, viene inserito un nodo
 * alla sua progressiva con la quota Z interpolata dal profilo.
 */
export function buildNodes(profile: ProfilePoint[], equipment: EquipmentItem[]): StationNode[] {
  const pts = [...profile].sort((a, b) => a.distanceM - b.distanceM);
  if (pts.length === 0) return [];

  const nodes: StationNode[] = pts.map((p, i) => {
    const eq = equipment.find(e => Math.abs(e.distanceM - p.distanceM) <= MATCH_TOL_M);
    let type: StationNodeType = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'pipe';
    if (eq) type = 'pump';

    return {
      id: eq ? eq.id : p.id,
      distanceM: p.distanceM,
      elevationZ: p.elevationZ,
      type,
      pumpConfig:
        eq && eq.kind === 'pump'
          ? { ...(eq.pumpConfig || DEFAULT_PUMP_CONFIG) }
          : undefined,
      notes: eq?.notes,
      ...(p.latitude !== undefined && p.longitude !== undefined
        ? { latitude: p.latitude, longitude: p.longitude }
        : {})
    };
  });

  // Motopompe non coincidenti con un punto del profilo: nodo con Z interpolata.
  const extra = equipment.filter(
    e => !pts.some(p => Math.abs(e.distanceM - p.distanceM) <= MATCH_TOL_M)
  );
  for (const e of extra) {
    nodes.push({
      id: e.id,
      distanceM: e.distanceM,
      elevationZ: interpolateZ(pts, e.distanceM),
      type: 'pump',
      pumpConfig: { ...(e.pumpConfig || DEFAULT_PUMP_CONFIG) },
      notes: e.notes
    });
  }

  return nodes.sort((a, b) => a.distanceM - b.distanceM);
}
