import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  StationNode,
  StationNodeType,
  CalculationResult,
  ProfilePoint,
  EquipmentItem,
  GpsTrackPoint
} from '../types';
import { splitNodes, interpolateZ } from './nodeModel';
import { DEFAULT_PUMP_TYPES } from '../engine/pumpCatalogue';

/** Risultato del caricamento di un file: geometria + dotazione + eventuale percorso GPS. */
export interface ParsedProjectData {
  profile: ProfilePoint[];
  equipment: EquipmentItem[];
  track?: GpsTrackPoint[];
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s_\-\.\/\[\]]/g, '');
}

interface ColumnKeys {
  distKey: string | null;
  elevKey: string | null;
  typeKey: string | null;
  modeKey: string | null;
  regKey: string | null;
  pumpKey: string | null;
  suctionKey: string | null;
  notesKey: string | null;
  latKey: string | null;
  lonKey: string | null;
}

function findColumnKeys(keys: string[]): ColumnKeys {
  const k: ColumnKeys = {
    distKey: null,
    elevKey: null,
    typeKey: null,
    modeKey: null,
    regKey: null,
    pumpKey: null,
    suctionKey: null,
    notesKey: null,
    latKey: null,
    lonKey: null
  };

  for (const key of keys) {
    const norm = normalizeHeader(key);
    if (
      !k.distKey &&
      (norm.includes('dist') ||
        norm.includes('lung') ||
        norm.includes('prog') ||
        norm.includes('diag') ||
        norm.includes('reale') ||
        norm === 'x' ||
        norm === 's' ||
        norm === 'l')
    ) {
      k.distKey = key;
    } else if (
      !k.elevKey &&
      (norm.includes('quota') || norm.includes('alt') || norm === 'z' || norm.includes('elev'))
    ) {
      k.elevKey = key;
    } else if (!k.typeKey && (norm.includes('elem') || norm.includes('tipo') || norm === 'nodo')) {
      k.typeKey = key;
    } else if (!k.modeKey && (norm.includes('modal') || norm === 'mode')) {
      k.modeKey = key;
    } else if (!k.regKey && (norm.includes('delta') || norm.includes('regolat'))) {
      k.regKey = key;
    } else if (!k.pumpKey && (norm.includes('pompa') || norm.includes('pump') || norm.includes('modello'))) {
      k.pumpKey = key;
    } else if (!k.suctionKey && (norm.includes('asp') || norm.includes('suction') || norm.includes('hasp'))) {
      k.suctionKey = key;
    } else if (!k.latKey && (norm.includes('lat') || norm === 'y')) {
      k.latKey = key;
    } else if (
      !k.lonKey &&
      (norm.includes('lon') || norm.includes('lng') || norm.includes('long') || norm === 'xgeo')
    ) {
      k.lonKey = key;
    } else if (!k.notesKey && (norm.includes('not') || norm.includes('desc') || norm.includes('info'))) {
      k.notesKey = key;
    }
  }

  if (!k.distKey && keys.length > 0) k.distKey = keys[0];
  if (!k.elevKey && keys.length > 1) k.elevKey = keys[1];

  return k;
}

/** Numero da cella CSV: vuoto/non numerico -> NaN (mai 0, che sarebbe un valore fisico). */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  const s = String(value).trim();
  if (s === '') return NaN;
  const n = Number(s);
  return Number.isNaN(n) ? NaN : n;
}

/**
 * Risolve l'identificativo della pompa: se la cella contiene già un id del catalogo
 * (es. "pump-12-10") o un id personalizzato lo usa tal quale, altrimenti interpreta
 * la descrizione testuale ("Motopompa 12/10", "8/8", ...).
 */
function resolvePumpId(rawPumpType: string): string {
  const t = (rawPumpType || '').trim();
  if (!t) return 'pump-8-8';
  const lower = t.toLowerCase();

  if (KNOWN_PUMP_IDS.has(lower)) return lower;

  // Una sigla numerica ("12-10", "8/8") è da interpretare, non è un id.
  if (/\d{1,2}\s*[/x-]\s*\d{1,2}/.test(t)) return pumpIdFromText(lower);

  // Id generici (personalizzati): conservati per il passaggio andata/ritorno.
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(lower)) return lower;

  return pumpIdFromText(lower);
}

/** Id del catalogo predefinito (serve a validare le sigle note). */
const KNOWN_PUMP_IDS = new Set(DEFAULT_PUMP_TYPES.map(p => p.id));

/**
 * Sigle note -> id del catalogo. Gli id storici non cambiano (restano validi i
 * file CSV già salvati): `pump-10-15` conserva la sigla EN "PFPN 10-1500",
 * cioè 1500 l/min a 10 bar.
 */
const PUMP_TEXT_ALIASES: Record<string, string> = {
  '8/8': 'pump-8-8',
  '10/8': 'pump-10-8',
  '12/8': 'pump-12-8',
  '16/8': 'pump-16-8',
  '10/10': 'pump-10-10',
  '12/10': 'pump-12-10',
  '16/10': 'pump-16-10',
  '15/10': 'pump-10-15',
  '10/15': 'pump-10-15',
  '12/12': 'pump-12-12'
};

/** Mappa la descrizione testuale del modello pompa su un id del catalogo. */
function pumpIdFromText(rawPumpType: string): string {
  const t = (rawPumpType || '').toLowerCase();

  // Famiglie riconosciute a parola
  if (/(aib|wick|mark\s*-?\s*3|alta\s*pressione|high\s*pressure|\bhp\b)/.test(t)) {
    return 'pump-aib-hp';
  }
  if (/(travas|sentina|bassa\s*pressione|carico\s*vasch)/.test(t)) {
    return 'pump-transfer';
  }

  // Sigla EN 1028 "FPN 10-1000" / "PFPN 10-1500": pressione-bar e portata l/min.
  // Va controllata prima della sigla nuda, che contiene anch'essa un trattino.
  const en = t.match(/\b(?:pfpn|fpn|fph)\s*(\d{1,2})\s*[-\/]\s*(\d{3,5})/);
  if (en) {
    const bar = Number(en[1]);
    const flowPer100 = Math.round(Number(en[2]) / 100);
    const direct = `pump-${flowPer100}-${bar}`;
    if (KNOWN_PUMP_IDS.has(direct)) return direct;
    const legacy = `pump-${bar}-${flowPer100}`;
    if (KNOWN_PUMP_IDS.has(legacy)) return legacy;
  }

  // Sigle note ("Motopompa 12/10", "8/8", "12-8", ...)
  const it = t.match(/(\d{1,2})\s*[/x-]\s*(\d{1,2}(?:[.,]\d)?)/);
  if (it) {
    const key = `${Number(it[1])}/${Number(String(it[2]).replace(',', '.'))}`;
    if (PUMP_TEXT_ALIASES[key]) return PUMP_TEXT_ALIASES[key];

    // Convenzione italiana "portata/100 : pressione" (es. 16/10 -> pump-16-10)
    const bar = String(Number(String(it[2]).replace(',', '.'))).replace('.', '-');
    const id = `pump-${Number(it[1])}-${bar}`;
    if (KNOWN_PUMP_IDS.has(id)) return id;
  }

  return 'pump-8-8';
}

/**
 * Parsing di un file CSV o Excel. Riconosce:
 *  - il formato a sezioni (prima "Motopompe", poi "Profilo Plano-Altimetrico");
 *  - il vecchio formato a tabella unica (geometria + dotazione mescolate);
 *  - un semplice file di solo profilo (Progressiva, Quota).
 */
export async function parseProjectFile(file: File): Promise<ParsedProjectData> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelProject(file);
  }
  return parseCSVProject(file);
}

function parseCSVProject(file: File): Promise<ParsedProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseCSVText(String(reader.result || '')));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Impossibile leggere il file.'));
    reader.readAsText(file);
  });
}

/**
 * Interpreta il contenuto testuale di un CSV di progetto (a sezioni o legacy).
 * Esportata per poter verificare il parser e riusarla da altri punti.
 */
export function parseCSVText(text: string): ParsedProjectData {
  const lines = text.split(/\r?\n/);
  const hasSections = lines.some(l => l.trim().startsWith('#'));

  if (hasSections) {
    return parseSectionedBlocks(lines);
  }

  const parsed = Papa.parse<Record<string, any>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  return processLegacyRows(parsed.data as Record<string, any>[]);
}

function parseSectionedBlocks(lines: string[]): ParsedProjectData {
  const profile: ProfilePoint[] = [];
  const equipment: EquipmentItem[] = [];
  const track: GpsTrackPoint[] = [];

  let currentSection: 'equipment' | 'profile' | 'track' | null = null;
  let block: string[] = [];

  const flush = () => {
    if (currentSection && block.length >= 2) {
      const parsed = Papa.parse<Record<string, any>>(block.join('\n'), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      const rows = parsed.data as Record<string, any>[];
      if (currentSection === 'equipment') {
        equipment.push(...rowsToEquipment(rows));
      } else if (currentSection === 'track') {
        track.push(...rowsToTrack(rows));
      } else {
        profile.push(...rowsToProfile(rows));
      }
    }
    block = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      flush();
      const lower = trimmed.toLowerCase();
      // Il percorso GPS va controllato prima del profilo: usa parole sue.
      if (/percors|gps|latitud/.test(lower)) {
        currentSection = 'track';
      } else if (/pomp|vasc|macchin|equip|dotazion/.test(lower)) {
        currentSection = 'equipment';
      } else if (/profil|altim|quota|tracciat|terreno|geometr|condotta/.test(lower)) {
        currentSection = 'profile';
      } else {
        currentSection = null;
      }
    } else if (trimmed.length > 0) {
      if (currentSection) block.push(line);
    }
  }
  flush();

  return finalize(profile, equipment, track);
}

function parseExcelProject(file: File): Promise<ParsedProjectData> {
  return file.arrayBuffer().then(data => {
    const workbook = XLSX.read(data, { type: 'array' });

    // File multi-foglio: un foglio per la dotazione e uno per il profilo.
    if (workbook.SheetNames.length >= 2) {
      let profile: ProfilePoint[] = [];
      let equipment: EquipmentItem[] = [];

      for (const name of workbook.SheetNames) {
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[name]);
        if (jsonRows.length === 0) continue;
        const lower = name.toLowerCase();
        if (/pomp|vasc|macchin|equip|dotazion/.test(lower)) {
          equipment.push(...rowsToEquipment(jsonRows));
        } else if (/profil|altim|quota|tracciat|terreno|geometr|condotta/.test(lower)) {
          profile.push(...rowsToProfile(jsonRows));
        }
      }

      if (profile.length >= 2) return finalize(profile, equipment);

      // Nomi non riconosciuti: primo foglio dotazione, secondo profilo.
      profile = [];
      equipment = [];
      const names = workbook.SheetNames;
      equipment = rowsToEquipment(
        XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[names[0]])
      );
      for (let i = 1; i < names.length; i++) {
        profile = rowsToProfile(
          XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[names[i]])
        );
        if (profile.length >= 2) break;
      }
      return finalize(profile, equipment);
    }

    // Foglio singolo: formato vecchio (tabella unica).
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(
      workbook.Sheets[workbook.SheetNames[0]]
    );
    return processLegacyRows(jsonRows);
  });
}

/** Converte righe di una sezione "Pompe" in dotazione. */
function rowsToEquipment(rows: Record<string, any>[]): EquipmentItem[] {
  if (!rows || rows.length === 0) return [];
  const k = findColumnKeys(Object.keys(rows[0]));
  const items: EquipmentItem[] = [];

  rows.forEach((row, idx) => {
    const dist = k.distKey ? toNumber(row[k.distKey]) : NaN;
    if (isNaN(dist)) return;

    const typeStr = k.typeKey ? String(row[k.typeKey] || '').toLowerCase() : '';
    const pumpStr = k.pumpKey ? String(row[k.pumpKey] || '').toLowerCase() : '';

    // Una riga "vascone" di un file vecchio non è più una macchina: il pelo
    // libero è dichiarato dalla motopompa che vi aspira (modo "asp."). La riga
    // si salta e la quota resta comunque nel profilo plano-altimetrico.
    if (typeStr.includes('vasc') || typeStr.includes('serb')) return;

    // Default: motopompa
    const modeStr = k.modeKey ? String(row[k.modeKey] || '').toLowerCase() : '';
    const rawSuction = k.suctionKey ? toNumber(row[k.suctionKey]) : NaN;
    const isSuction =
      modeStr.includes('asp') ||
      modeStr.includes('vasc') ||
      typeStr.includes('asp') ||
      (!isNaN(rawSuction) && rawSuction > 0);
    const regulated = k.regKey ? toNumber(row[k.regKey]) : NaN;

    items.push({
      id: `eq-${idx}-${Date.now().toString(36)}`,
      distanceM: dist,
      kind: 'pump',
      pumpConfig: {
        pumpTypeId: resolvePumpId(pumpStr),
        mode: isSuction ? 'vascone_suction' : 'direct',
        suctionLiftM: isSuction ? (!isNaN(rawSuction) && rawSuction > 0 ? rawSuction : 2.0) : 0,
        regulatedBoostBar: !isNaN(regulated) ? regulated : undefined
      },
      notes: k.notesKey ? String(row[k.notesKey] || '') || undefined : undefined
    });
  });

  return items;
}

/** Converte righe di una sezione "Profilo Plano-Altimetrico" in punti profilo. */
function rowsToProfile(rows: Record<string, any>[]): ProfilePoint[] {
  if (!rows || rows.length === 0) return [];
  const k = findColumnKeys(Object.keys(rows[0]));
  const points: ProfilePoint[] = [];

  rows.forEach((row, idx) => {
    const dist = k.distKey ? toNumber(row[k.distKey]) : NaN;
    const elev = k.elevKey ? toNumber(row[k.elevKey]) : NaN;
    if (isNaN(dist) || isNaN(elev)) return;
    const lat = k.latKey ? toNumber(row[k.latKey]) : NaN;
    const lon = k.lonKey ? toNumber(row[k.lonKey]) : NaN;
    const hasGeo = isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    points.push({
      id: `pt-${idx}-${Date.now().toString(36)}`,
      distanceM: dist,
      elevationZ: elev,
      ...(hasGeo ? { latitude: lat, longitude: lon } : {})
    });
  });

  return points;
}

/** Converte righe di una sezione "Percorso GPS" in punti con coordinate. */
function rowsToTrack(rows: Record<string, any>[]): GpsTrackPoint[] {
  if (!rows || rows.length === 0) return [];
  const k = findColumnKeys(Object.keys(rows[0]));
  const track: GpsTrackPoint[] = [];

  rows.forEach(row => {
    const dist = k.distKey ? toNumber(row[k.distKey]) : NaN;
    const elev = k.elevKey ? toNumber(row[k.elevKey]) : NaN;
    const lat = k.latKey ? toNumber(row[k.latKey]) : NaN;
    const lon = k.lonKey ? toNumber(row[k.lonKey]) : NaN;
    if (isNaN(dist) || !isFinite(lat) || !isFinite(lon)) return;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    track.push({
      distanceM: dist,
      elevationZ: isFinite(elev) ? elev : 0,
      latitude: lat,
      longitude: lon
    });
  });

  return track;
}

/** Formato storico: tabella unica con geometria ed eventuali colonne pompa. */
function processLegacyRows(rows: Record<string, any>[]): ParsedProjectData {
  if (!rows || rows.length === 0) {
    throw new Error('Il file è vuoto o non contiene dati validi.');
  }

  const k = findColumnKeys(Object.keys(rows[0]));
  const nodes: StationNode[] = [];

  rows.forEach((row, idx) => {
    const rawDist = k.distKey ? toNumber(row[k.distKey]) : idx * 50;
    const rawElev = k.elevKey ? toNumber(row[k.elevKey]) : 0;
    if (isNaN(rawDist) || isNaN(rawElev)) return;

    const rawTypeStr = k.typeKey ? String(row[k.typeKey] || '').toLowerCase() : '';
    let nodeType: StationNodeType = 'pipe';
    if (idx === 0) nodeType = 'start';
    else if (idx === rows.length - 1) nodeType = 'end';

    if (rawTypeStr.includes('pomp') || rawTypeStr.includes('pump')) {
      nodeType = 'pump';
    } else if (rawTypeStr.includes('vasc') || rawTypeStr.includes('serb')) {
      // Vecchio tipo "vascone": il pelo libero non è più un nodo a sé, resta la
      // quota del profilo. Se vi aspira una motopompa, lo dichiara la pompa.
      nodeType = 'pipe';
    } else if (rawTypeStr.includes('term') || rawTypeStr.includes('lanc') || rawTypeStr.includes('fine')) {
      nodeType = 'end';
    } else if (rawTypeStr.includes('pres') || rawTypeStr.includes('iniz') || rawTypeStr.includes('sorg')) {
      nodeType = 'start';
    }

    let pumpConfig = undefined;
    if (nodeType === 'pump') {
      const rawPumpType = k.pumpKey ? String(row[k.pumpKey] || '').toLowerCase() : '';
      const rawSuction = k.suctionKey ? toNumber(row[k.suctionKey]) : NaN;
      const modeStr = k.modeKey ? String(row[k.modeKey] || '').toLowerCase() : '';
      const isSuction =
        modeStr.includes('asp') ||
        modeStr.includes('vasc') ||
        rawTypeStr.includes('asp') ||
        (!isNaN(rawSuction) && rawSuction > 0);

      pumpConfig = {
        pumpTypeId: resolvePumpId(rawPumpType),
        mode: isSuction ? ('vascone_suction' as const) : ('direct' as const),
        suctionLiftM: isSuction ? (!isNaN(rawSuction) && rawSuction > 0 ? rawSuction : 2.0) : 0
      };
    }

    nodes.push({
      id: `node-${idx}-${Date.now().toString(36)}`,
      distanceM: rawDist,
      elevationZ: rawElev,
      type: nodeType,
      pumpConfig,
      notes: k.notesKey ? String(row[k.notesKey] || '') || undefined : undefined
    });
  });

  if (nodes.length < 2) {
    throw new Error('Il file deve contenere almeno 2 punti del profilo altimetrico.');
  }

  if (nodes[0].type === 'pipe') nodes[0].type = 'start';
  if (nodes[nodes.length - 1].type === 'pipe') nodes[nodes.length - 1].type = 'end';

  const sorted = nodes.sort((a, b) => a.distanceM - b.distanceM);
  const split = splitNodes(sorted);
  return { profile: split.profile, equipment: split.equipment };
}

function finalize(
  profile: ProfilePoint[],
  equipment: EquipmentItem[],
  track: GpsTrackPoint[] = []
): ParsedProjectData {
  const sortedProfile = [...profile].sort((a, b) => a.distanceM - b.distanceM);
  if (sortedProfile.length < 2) {
    throw new Error(
      'Il file deve contenere almeno 2 punti del profilo plano-altimetrico (progressiva e quota).'
    );
  }
  const sortedEquipment = [...equipment].sort((a, b) => a.distanceM - b.distanceM);
  const sortedTrack = [...track].sort((a, b) => a.distanceM - b.distanceM);
  return {
    profile: sortedProfile,
    equipment: sortedEquipment,
    ...(sortedTrack.length > 0 ? { track: sortedTrack } : {})
  };
}

/**
 * Esporta il progetto in CSV a sezioni: prima la dotazione (motopompe), poi il
 * profilo plano-altimetrico (con latitudine e longitudine quando noti), infine
 * il percorso GPS a piena risoluzione, così il tracciato è visibile in mappa
 * importandolo in un'app geografica. Ricaricabile anche per la sola parte
 * profilo.
 */
export function exportProjectToCSV(
  profile: ProfilePoint[],
  equipment: EquipmentItem[],
  track: GpsTrackPoint[] = []
): string {
  const sortedProfile = [...profile].sort((a, b) => a.distanceM - b.distanceM);
  const sortedEquipment = [...equipment].sort((a, b) => a.distanceM - b.distanceM);
  const sortedTrack = [...track].sort((a, b) => a.distanceM - b.distanceM);

  const lines: string[] = [];

  lines.push('# SEZIONE 1 - MOTOPOMPE');
  lines.push(
    'Progressiva [m],Quota Z [m],Tipo,Modello Pompa,Modalita,Altezza Aspirazione [m],Delta P regolata [bar],Note'
  );
  sortedEquipment.forEach(e => {
    const z = interpolateZ(sortedProfile, e.distanceM);
    const model = e.pumpConfig?.pumpTypeId || 'pump-8-8';
    const mode = e.pumpConfig?.mode || 'direct';
    const suction =
      e.pumpConfig?.mode === 'vascone_suction' ? (e.pumpConfig?.suctionLiftM ?? 0).toFixed(1) : '';
    const regulated =
      e.pumpConfig?.regulatedBoostBar !== undefined
        ? e.pumpConfig.regulatedBoostBar.toFixed(1)
        : '';
    const note = e.notes ? `"${e.notes.replace(/"/g, '""')}"` : '';
    lines.push(
      [e.distanceM.toFixed(1), z.toFixed(1), 'motopompa', model, mode, suction, regulated, note].join(',')
    );
  });

  lines.push('');
  lines.push('# SEZIONE 2 - PROFILO PLANO-ALTIMETRICO');
  lines.push('Progressiva [m],Quota Z [m],Latitudine,Longitudine,Note');
  sortedProfile.forEach(p => {
    const lat = p.latitude !== undefined && isFinite(p.latitude) ? p.latitude.toFixed(7) : '';
    const lon = p.longitude !== undefined && isFinite(p.longitude) ? p.longitude.toFixed(7) : '';
    lines.push([p.distanceM.toFixed(1), p.elevationZ.toFixed(1), lat, lon, ''].join(','));
  });

  if (sortedTrack.length > 0) {
    lines.push('');
    lines.push('# SEZIONE 3 - PERCORSO GPS (LATITUDINE / LONGITUDINE)');
    lines.push('Progressiva [m],Latitudine,Longitudine,Quota Z [m]');
    sortedTrack.forEach(t => {
      lines.push(
        [t.distanceM.toFixed(1), t.latitude.toFixed(7), t.longitude.toFixed(7), t.elevationZ.toFixed(1)].join(
          ','
        )
      );
    });
  }

  return lines.join('\n');
}

/**
 * Esporta la tabella completa dei risultati con P_in e P_out
 */
export function exportCalculationReportToCSV(result: CalculationResult): string {
  const headers = [
    'Distanza Reale [m]',
    'Quota Terreno Z [m]',
    'Quota Piezometrica H [m]',
    'Pressione Ingresso P_in [bar]',
    'Pressione Uscita P_out [bar]',
    'Perdita Tratta [m]',
    'Perdita Cumulata [m]',
    'Stato',
    'Note'
  ];

  const rows = result.points.map(pt => [
    pt.distanceM.toFixed(1),
    pt.elevationZ.toFixed(2),
    pt.hydraulicGradeH.toFixed(2),
    pt.inletPressureBar.toFixed(2),
    pt.outletPressureBar.toFixed(2),
    pt.segmentLossM.toFixed(2),
    pt.cumulativeLossM.toFixed(2),
    pt.status.toUpperCase(),
    `"${(pt.statusMessage || pt.node.notes || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function downloadTextFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
