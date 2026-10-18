import { StationNode, ProjectConfig } from '../types';

export interface SampleScenario {
  id: string;
  name: string;
  description: string;
  config: Partial<ProjectConfig>;
  nodes: StationNode[];
}

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: 'aib-salita-monte',
    name: 'Incendio Boschivo - Staffetta Mista (DN 70, dislivello +180 m)',
    description:
      'Tracciato montano di 960 m reali a 400 l/min: partenza da autobotte in pressione (6 bar), due stazioni di rilancio 8/8 in diretta a 175 m e 585 m, motopompa 10/8 che aspira a pelo libero (vascone AIB) a 695 m per alimentare la lancia finale.',
    config: {
      targetFlowLpm: 400,
      defaultDiameterMm: 70,
      hazenWilliamsC: 140,
      localizedLossPercent: 12,
      sourcePressureBar: 6,
      minLinePressureBar: 1.0,
      maxLinePressureBar: 12.0,
      requiredEndPressureBar: 3.5,
      hoseSectionLengthM: 20
    },
    nodes: [
      { id: 'node-0', distanceM: 0, elevationZ: 420, type: 'start', notes: 'Partenza da autobotte: mandata in pressione (6 bar residui)' },
      { id: 'node-1', distanceM: 100, elevationZ: 440, type: 'pipe' },
      {
        id: 'node-2',
        distanceM: 175,
        elevationZ: 455,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-8-8',
          mode: 'direct'
        },
        notes: 'Prima stazione di rilancio - Motopompa 8/8 in diretta'
      },
      { id: 'node-3', distanceM: 300, elevationZ: 480, type: 'pipe' },
      { id: 'node-4', distanceM: 400, elevationZ: 500, type: 'pipe' },
      {
        id: 'node-5',
        distanceM: 585,
        elevationZ: 537,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-8-8',
          mode: 'direct'
        },
        notes: 'Seconda stazione di rilancio - Motopompa 8/8 in diretta'
      },
      {
        id: 'node-6',
        distanceM: 690,
        elevationZ: 558,
        type: 'pipe'
      },
      {
        id: 'node-7',
        distanceM: 695,
        elevationZ: 560,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-10-8',
          mode: 'vascone_suction',
          suctionLiftM: 2.0
        },
        notes: 'Motopompa 10/8 in aspirazione dal vascone (H_asp = 2.0 m)'
      },
      { id: 'node-8', distanceM: 830, elevationZ: 578, type: 'pipe' },
      { id: 'node-9', distanceM: 960, elevationZ: 600, type: 'end', notes: 'Lancia finale UNI 70 su fronte fiamma' }
    ]
  },
  {
    id: 'rifornimento-fiume-12-10',
    name: 'Rifornimento a Grande Portata da Fiume (DN 70, 1000 l/min)',
    description:
      'Pompaggio di 1000 l/min da alveo fluviale verso la vasca di accumulo sul colle (955 m, +110 m): motopompa 12/10 in aspirazione dal fiume (H_asp = 3,0 m) e tre stazioni di rilancio (12/10, 10/8, 10/8) per vincere le perdite di una linea DN 70 percorsa a grande portata.',
    config: {
      targetFlowLpm: 1000,
      defaultDiameterMm: 70,
      hazenWilliamsC: 140,
      localizedLossPercent: 10,
      sourcePressureBar: 0, // partenza con motopompa in aspirazione: non applicata
      minLinePressureBar: 1.0,
      maxLinePressureBar: 14.0,
      requiredEndPressureBar: 1.5,
      hoseSectionLengthM: 20
    },
    nodes: [
      {
        id: 'node-f-0',
        distanceM: 0,
        elevationZ: 150,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-12-10',
          mode: 'vascone_suction',
          suctionLiftM: 3.0
        },
        notes: 'Presa da alveo fluviale - Motopompa 12/10 in aspirazione (H_asp = 3,0 m)'
      },
      { id: 'node-f-1', distanceM: 155, elevationZ: 165, type: 'pipe' },
      {
        id: 'node-f-2',
        distanceM: 240,
        elevationZ: 178,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-12-10',
          mode: 'direct'
        },
        notes: 'Prima stazione di rilancio - Motopompa 12/10 in diretta'
      },
      { id: 'node-f-3', distanceM: 330, elevationZ: 188, type: 'pipe' },
      {
        id: 'node-f-4',
        distanceM: 480,
        elevationZ: 205,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-10-8',
          mode: 'direct'
        },
        notes: 'Seconda stazione di rilancio - Motopompa 10/8 in diretta'
      },
      { id: 'node-f-5', distanceM: 590, elevationZ: 218, type: 'pipe' },
      {
        id: 'node-f-6',
        distanceM: 720,
        elevationZ: 234,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-10-8',
          mode: 'direct'
        },
        notes: 'Terza stazione di rilancio - Motopompa 10/8 in diretta'
      },
      { id: 'node-f-7', distanceM: 830, elevationZ: 245, type: 'pipe' },
      { id: 'node-f-8', distanceM: 955, elevationZ: 260, type: 'end', notes: 'Carico vasca di accumulo sommitale' }
    ]
  },
  {
    id: 'linea-colle-attacco',
    name: 'Linea su Colle - Attacco Antincendio (DN 45, dislivello +150 m)',
    description:
      'Attacco antincendio su versante ripido (730 m, +150 m) con linea UNI 45 a 250 l/min: partenza da autobotte in pressione (6 bar) e tre rilanci 8/8 in diretta, uno ogni ~260 m, per mantenere almeno 1,5 bar fra una stazione e la successiva.',
    config: {
      targetFlowLpm: 250,
      defaultDiameterMm: 45,
      hazenWilliamsC: 135,
      localizedLossPercent: 15,
      sourcePressureBar: 6,
      minLinePressureBar: 1.0,
      maxLinePressureBar: 12.0,
      requiredEndPressureBar: 3.5,
      hoseSectionLengthM: 20
    },
    nodes: [
      { id: 'node-c-0', distanceM: 0, elevationZ: 300, type: 'start', notes: 'Partenza da autobotte a fondo valle (6 bar residui)' },
      {
        id: 'node-c-1',
        distanceM: 110,
        elevationZ: 323,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-8-8',
          mode: 'direct'
        },
        notes: 'Primo rilancio - Motopompa 8/8 in diretta'
      },
      { id: 'node-c-2', distanceM: 240, elevationZ: 349, type: 'pipe' },
      {
        id: 'node-c-3',
        distanceM: 372,
        elevationZ: 376,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-8-8',
          mode: 'direct'
        },
        notes: 'Secondo rilancio - Motopompa 8/8 in diretta'
      },
      { id: 'node-c-4', distanceM: 460, elevationZ: 395, type: 'pipe' },
      {
        id: 'node-c-5',
        distanceM: 634,
        elevationZ: 430,
        type: 'pump',
        pumpConfig: {
          pumpTypeId: 'pump-8-8',
          mode: 'direct'
        },
        notes: 'Terzo rilancio - Motopompa 8/8 in diretta'
      },
      { id: 'node-c-6', distanceM: 730, elevationZ: 450, type: 'end', notes: 'Attacco antincendio' }
    ]
  },
  {
    id: 'relay-7-motopompe-2489m',
    name: 'Relay 7 Motopompe - Linea lunga 2.489 m (DN 70, dislivello +211 m)',
    description:
      'Progetto reale esportato in CSV (profilo_e_dotazione): 2.489 m a 600 l/min, partenza a pelo libero con la 12/10 in aspirazione a 0 m e sei rilanci in serie (12/12, 16/8, 16/8, 8/8, 16/10, 8/8) fino a 2.357 m, poi 132 m di linea fino alla lancia. Impostato per manichette PN 15 (P. Max Tubo 15 bar): nessun allarme.',
    config: {
      targetFlowLpm: 600,
      defaultDiameterMm: 70,
      hazenWilliamsC: 140,
      localizedLossPercent: 12,
      sourcePressureBar: 0,
      minLinePressureBar: 1.0,
      maxLinePressureBar: 15.0,
      requiredEndPressureBar: 3.5,
      hoseSectionLengthM: 20
    },
    nodes: [
      { id: 'node-0', distanceM: 0, elevationZ: 828.5, type: 'pump', pumpConfig: { pumpTypeId: 'pump-12-10', mode: 'vascone_suction', suctionLiftM: 2, regulatedBoostBar: 11 } },
      { id: 'node-1', distanceM: 60.8, elevationZ: 826.5, type: 'pipe' },
      { id: 'node-2', distanceM: 125.1, elevationZ: 825.3, type: 'pipe' },
      { id: 'node-3', distanceM: 190.8, elevationZ: 823, type: 'pipe' },
      { id: 'node-4', distanceM: 254.8, elevationZ: 823, type: 'pipe' },
      { id: 'node-5', distanceM: 314.6, elevationZ: 824.8, type: 'pipe' },
      { id: 'node-6', distanceM: 378.9, elevationZ: 825.9, type: 'pipe' },
      { id: 'node-7', distanceM: 440.1, elevationZ: 828.5, type: 'pipe' },
      { id: 'node-8', distanceM: 495.5, elevationZ: 833.3, type: 'pipe' },
      { id: 'node-9', distanceM: 554.9, elevationZ: 840.6, type: 'pipe' },
      { id: 'node-10', distanceM: 612.8, elevationZ: 845.3, type: 'pipe' },
      { id: 'node-11', distanceM: 665.1, elevationZ: 844.8, type: 'pipe' },
      { id: 'node-12', distanceM: 695.5, elevationZ: 848, type: 'pump', pumpConfig: { pumpTypeId: 'pump-12-12', mode: 'direct', regulatedBoostBar: 12 } },
      { id: 'node-13', distanceM: 721.7, elevationZ: 850.4, type: 'pipe' },
      { id: 'node-14', distanceM: 778.6, elevationZ: 862.7, type: 'pipe' },
      { id: 'node-15', distanceM: 840.5, elevationZ: 876, type: 'pipe' },
      { id: 'node-16', distanceM: 901.9, elevationZ: 886.8, type: 'pipe' },
      { id: 'node-17', distanceM: 964.3, elevationZ: 898.1, type: 'pipe' },
      { id: 'node-18', distanceM: 1020.7, elevationZ: 908.4, type: 'pipe' },
      { id: 'node-19', distanceM: 1074.2, elevationZ: 914.8, type: 'pipe' },
      { id: 'node-20', distanceM: 1086.4, elevationZ: 917, type: 'pump', pumpConfig: { pumpTypeId: 'pump-16-8', mode: 'direct', regulatedBoostBar: 7 } },
      { id: 'node-21', distanceM: 1130.7, elevationZ: 924.4, type: 'pipe' },
      { id: 'node-22', distanceM: 1189.9, elevationZ: 927.4, type: 'pipe' },
      { id: 'node-23', distanceM: 1248.7, elevationZ: 933.5, type: 'pipe' },
      { id: 'node-24', distanceM: 1307.7, elevationZ: 940.5, type: 'pipe' },
      { id: 'node-25', distanceM: 1365.9, elevationZ: 944.1, type: 'pipe' },
      { id: 'node-26', distanceM: 1425.4, elevationZ: 948.9, type: 'pipe' },
      { id: 'node-27', distanceM: 1476.9, elevationZ: 952.9, type: 'pipe' },
      { id: 'node-28', distanceM: 1484.8, elevationZ: 954, type: 'pump', pumpConfig: { pumpTypeId: 'pump-16-8', mode: 'direct', regulatedBoostBar: 4 } },
      { id: 'node-29', distanceM: 1531.2, elevationZ: 958.7, type: 'pipe' },
      { id: 'node-30', distanceM: 1581.4, elevationZ: 963.8, type: 'pipe' },
      { id: 'node-31', distanceM: 1633.2, elevationZ: 959.2, type: 'pipe' },
      { id: 'node-32', distanceM: 1686.9, elevationZ: 957.8, type: 'pipe' },
      { id: 'node-33', distanceM: 1743.1, elevationZ: 954.6, type: 'pipe' },
      { id: 'node-34', distanceM: 1793.2, elevationZ: 957.8, type: 'pipe' },
      { id: 'node-35', distanceM: 1811.3, elevationZ: 958, type: 'pump', pumpConfig: { pumpTypeId: 'pump-8-8', mode: 'direct', regulatedBoostBar: 4 } },
      { id: 'node-36', distanceM: 1853.5, elevationZ: 958.3, type: 'pipe' },
      { id: 'node-37', distanceM: 1902.8, elevationZ: 961.7, type: 'pipe' },
      { id: 'node-38', distanceM: 1957.7, elevationZ: 966.1, type: 'pipe' },
      { id: 'node-39', distanceM: 2007.8, elevationZ: 969.6, type: 'pipe' },
      { id: 'node-40', distanceM: 2058.2, elevationZ: 980.6, type: 'pipe' },
      { id: 'node-41', distanceM: 2059.2, elevationZ: 981, type: 'pump', pumpConfig: { pumpTypeId: 'pump-16-10', mode: 'direct', regulatedBoostBar: 9.6 } },
      { id: 'node-42', distanceM: 2108.9, elevationZ: 992.8, type: 'pipe' },
      { id: 'node-43', distanceM: 2159.1, elevationZ: 1001.6, type: 'pipe' },
      { id: 'node-44', distanceM: 2209.4, elevationZ: 1012.7, type: 'pipe' },
      { id: 'node-45', distanceM: 2262.3, elevationZ: 1020.8, type: 'pipe' },
      { id: 'node-46', distanceM: 2315.1, elevationZ: 1028.1, type: 'pipe' },
      { id: 'node-47', distanceM: 2357.2, elevationZ: 1032, type: 'pump', pumpConfig: { pumpTypeId: 'pump-8-8', mode: 'direct', regulatedBoostBar: 8 } },
      { id: 'node-48', distanceM: 2364.8, elevationZ: 1032.6, type: 'pipe' },
      { id: 'node-49', distanceM: 2424, elevationZ: 1032.4, type: 'pipe' },
      { id: 'node-50', distanceM: 2489.2, elevationZ: 1039.9, type: 'end' }
    ]
  }
];
