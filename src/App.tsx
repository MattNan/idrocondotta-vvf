import React, { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { HydraulicChart } from './components/HydraulicChart';
import { ControlPanel } from './components/ControlPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { EquipmentPanel } from './components/EquipmentPanel';
import { AdvisoryPanel } from './components/AdvisoryPanel';
import { GpsFieldMode } from './components/GpsFieldMode';
import { PumpManagerModal } from './components/PumpManagerModal';
import { FileImportExportModal } from './components/FileImportExportModal';
import { HydraulicReport } from './components/HydraulicReport';
import { RouteMapMarker } from './components/RouteMap';
import { calculateHydraulicProfile } from './engine/hydraulicEngine';
import { findPumpType } from './engine/pumpCatalogue';
import { SAMPLE_SCENARIOS } from './data/sampleProfiles';
import { buildNodes, splitNodes } from './utils/nodeModel';
import { ParsedProjectData } from './utils/fileParser';
import {
  loadPumpTypes,
  savePumpTypes,
  loadSavedScenarios,
  saveSavedScenarios
} from './utils/scenarioStore';
import {
  ProjectConfig,
  ProfilePoint,
  EquipmentItem,
  PumpType,
  GpsTrackPayload,
  GpsTrackPoint,
  SavedScenario
} from './types';

const DEFAULT_CONFIG: ProjectConfig = {
  targetFlowLpm: 600,
  defaultDiameterMm: 70,
  hazenWilliamsC: 140,
  localizedLossPercent: 12,
  // La partenza è a pelo libero: nessuna pressione residua all'origine.
  sourcePressureBar: 0,
  minLinePressureBar: 1.0,
  maxLinePressureBar: 12.0,
  requiredEndPressureBar: 3.5,
  hoseSectionLengthM: 20,
  pumpTypes: []
};

const INITIAL_PROJECT = splitNodes(SAMPLE_SCENARIOS[0].nodes);

export function App() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SAMPLE_SCENARIOS[0].id);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [config, setConfig] = useState<ProjectConfig>({
    ...DEFAULT_CONFIG,
    ...SAMPLE_SCENARIOS[0].config,
    // Il catalogo motopompe è una scelta dell'operatore, non dello scenario.
    pumpTypes: loadPumpTypes()
  });

  // Geometria del tracciato (profilo plano-altimetrico)
  const [profile, setProfile] = useState<ProfilePoint[]>(INITIAL_PROJECT.profile);
  // Dotazione idraulica (motopompe)
  const [equipment, setEquipment] = useState<EquipmentItem[]>(INITIAL_PROJECT.equipment);
  // Percorso GPS a piena risoluzione (coordinate per la mappa e l'export)
  const [gpsTrack, setGpsTrack] = useState<GpsTrackPoint[]>([]);

  // Scenari salvati in fretta dall'operatore (persistiti nel browser)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(loadSavedScenarios());

  const [activeTab, setActiveTab] = useState<'project' | 'gps' | 'pumps' | 'report'>('project');
  const [highlightStationM, setHighlightStationM] = useState<number | undefined>(undefined);

  // Modali
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isPumpModalOpen, setIsPumpModalOpen] = useState(false);

  // Nodi per il motore idraulico, derivati da profilo + dotazione
  const nodes = useMemo(() => buildNodes(profile, equipment), [profile, equipment]);

  // Calcolo idraulico reattivo
  const calculationResult = useMemo(() => {
    return calculateHydraulicProfile(nodes, config);
  }, [nodes, config]);

  // Macchine da indicare sulla mappa planimetrica
  const mapMarkers = useMemo<RouteMapMarker[]>(
    () =>
      equipment.map(e => ({
        distanceM: e.distanceM,
        kind: 'pump' as const,
        label: findPumpType(
          e.pumpConfig?.pumpTypeId ?? 'pump-8-8',
          config.pumpTypes
        )
          .name.split('(')[0]
          .trim()
      })),
    [equipment, config.pumpTypes]
  );

  /**
   * Stato della macchina alla progressiva 0: serve al pannello parametri per
   * spiegare quando la "P. Sorgente" viene usata o ignorata dal calcolo.
   */
  const sourceMachine = useMemo(() => {
    if (nodes.length === 0) return { isSuctionPump: false, hasDirectPump: false };
    const first = [...nodes].sort((a, b) => a.distanceM - b.distanceM)[0];
    if (first.type !== 'pump') return { isSuctionPump: false, hasDirectPump: false };
    const suction = first.pumpConfig?.mode === 'vascone_suction';
    return { isSuctionPump: suction, hasDirectPump: !suction };
  }, [nodes]);

  /** Etichetta dello scenario attivo mostrata nel menù "salva rapido". */  const currentScenarioLabel = useMemo(() => {
    if (selectedSavedId) {
      const saved = savedScenarios.find(s => s.id === selectedSavedId);
      if (saved) return saved.name;
    }
    const example = SAMPLE_SCENARIOS.find(s => s.id === selectedScenarioId);
    if (example) return example.name;
    return 'Progetto corrente';
  }, [selectedSavedId, selectedScenarioId, savedScenarios]);

  // Applica una geometria allo stato del progetto, conservando il catalogo pompe.
  const applyScenario = (
    scenarioConfig: Partial<ProjectConfig>,
    nextProfile: ProfilePoint[],
    nextEquipment: EquipmentItem[],
    nextTrack: GpsTrackPoint[] | undefined,
    ids: { scenarioId?: string; savedId?: string | null }
  ) => {
    setConfig(prev => ({
      ...prev,
      ...scenarioConfig,
      pumpTypes: prev.pumpTypes
    }));
    setProfile(nextProfile);
    setEquipment(nextEquipment);
    setGpsTrack(nextTrack ?? []);
    setSelectedScenarioId(ids.scenarioId ?? '');
    setSelectedSavedId(ids.savedId ?? null);
    setHighlightStationM(undefined);
  };

  // Gestione cambio scenario d'esempio
  const handleLoadExampleScenario = (id: string) => {
    const scenario = SAMPLE_SCENARIOS.find(s => s.id === id);
    if (!scenario) return;
    const split = splitNodes(scenario.nodes);
    applyScenario(scenario.config, split.profile, split.equipment, undefined, { scenarioId: id });
  };

  // Salva rapido del progetto corrente
  const handleSaveCurrentScenario = (name: string) => {
    const scenario: SavedScenario = {
      id: `scenario-${Date.now()}`,
      name,
      createdAt: Date.now(),
      config: { ...config },
      profile: profile.map(p => ({ ...p })),
      equipment: equipment.map(e => ({ ...e })),
      ...(gpsTrack.length > 0 ? { track: gpsTrack.map(t => ({ ...t })) } : {})
    };
    const next = [scenario, ...savedScenarios];
    setSavedScenarios(next);
    saveSavedScenarios(next);
    setSelectedSavedId(scenario.id);
    setSelectedScenarioId('');
  };

  const handleLoadSavedScenario = (id: string) => {
    const scenario = savedScenarios.find(s => s.id === id);
    if (!scenario) return;
    applyScenario(
      scenario.config,
      scenario.profile.map(p => ({ ...p })),
      scenario.equipment.map(e => ({ ...e })),
      scenario.track,
      { scenarioId: '', savedId: id }
    );
  };

  const handleDeleteSavedScenario = (id: string) => {
    const next = savedScenarios.filter(s => s.id !== id);
    setSavedScenarios(next);
    saveSavedScenarios(next);
    if (selectedSavedId === id) setSelectedSavedId(null);
  };

  // Azione rapida dal pannello consigli: aggiungi pompa a una progressiva (dotazione)
  const handleAddPumpAtStation = (stationM: number, pumpTypeId: string) => {
    setEquipment(prev => {
      const existingIndex = prev.findIndex(e => Math.abs(e.distanceM - stationM) < 2);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          kind: 'pump',
          pumpConfig: {
            pumpTypeId,
            mode: 'direct'
          },
          notes: 'Pompa di rilancio aggiunta su consiglio idraulico'
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: `eq-adv-${Date.now()}`,
          distanceM: Math.round(stationM),
          kind: 'pump',
          pumpConfig: {
            pumpTypeId,
            mode: 'direct'
          },
          notes: 'Pompa inserita da suggerimento idraulico'
        }
      ];
    });

    setHighlightStationM(stationM);
  };

  const handleApplyGpsTrack = (payload: GpsTrackPayload) => {
    const split = splitNodes(payload.nodes);
    setProfile(split.profile);
    setEquipment(split.equipment);
    setGpsTrack(payload.track ?? []);
    setConfig(prev => ({
      ...prev,
      ...(payload.targetFlowLpm !== undefined ? { targetFlowLpm: payload.targetFlowLpm } : {}),
      ...(payload.sourcePressureBar !== undefined ? { sourcePressureBar: payload.sourcePressureBar } : {})
    }));
    setSelectedScenarioId('');
    setSelectedSavedId(null);
    setActiveTab('project');
  };

  const handleImportProject = (data: ParsedProjectData) => {
    setProfile(data.profile);
    setEquipment(data.equipment);
    setGpsTrack(data.track ?? []);
    setSelectedScenarioId('');
    setSelectedSavedId(null);
  };

  const handleSavePumpTypes = (newPumpTypes: PumpType[]) => {
    setConfig(prev => ({
      ...prev,
      pumpTypes: newPumpTypes
    }));
    savePumpTypes(newPumpTypes);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col print:bg-white print:min-h-0">
      {/* Top Navigation (esclusa dalla stampa) */}
      <div className="print:hidden">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          result={calculationResult}
          onOpenImportExport={() => setIsImportExportOpen(true)}
          savedScenarios={savedScenarios}
          currentScenarioLabel={currentScenarioLabel}
          onSaveCurrentScenario={handleSaveCurrentScenario}
          onLoadSavedScenario={handleLoadSavedScenario}
          onDeleteSavedScenario={handleDeleteSavedScenario}
          onLoadExampleScenario={handleLoadExampleScenario}
        />
      </div>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 print:p-0 print:max-w-none">
        {activeTab === 'gps' ? (
          <GpsFieldMode
            config={config}
            onApplyGpsTrack={handleApplyGpsTrack}
            onExit={() => setActiveTab('project')}
          />
        ) : activeTab === 'pumps' ? (
          <div className="max-w-3xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-200">Catalogo e Gestione Pompe Antincendio</h2>
              <button
                onClick={() => setActiveTab('project')}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"
              >
                Torna alla Condotta
              </button>
            </div>
            <PumpManagerModal
              isOpen={true}
              onClose={() => setActiveTab('project')}
              pumpTypes={config.pumpTypes}
              onSavePumpTypes={handleSavePumpTypes}
            />
          </div>
        ) : activeTab === 'report' ? (
          <HydraulicReport
            config={config}
            result={calculationResult}
            track={gpsTrack}
            scenarioLabel={currentScenarioLabel}
            onBack={() => setActiveTab('project')}
          />
        ) : (
          <div className="space-y-4">
            {/* Top KPI & Feasibility Banner */}
            <AdvisoryPanel
              result={calculationResult}
              config={config}
              onAddPumpAtStation={handleAddPumpAtStation}
              onHighlightStation={(st) => setHighlightStationM(st)}
            />

            {/* Split Grid Layout: su smartphone l'ordine è grafico, parametri
                idraulici, profilo altimetrico, dotazione (i parametri servono
                prima di leggere il profilo). Su desktop restano due colonne. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Elevation & Piezometric Chart */}
              <div className="h-[430px] lg:col-span-8 lg:col-start-1 lg:row-start-1">
                <HydraulicChart
                  result={calculationResult}
                  config={config}
                  onSelectStation={(st) => setHighlightStationM(st)}
                />
              </div>

              {/* Parametri Idraulici Condotta (su smartphone subito dopo il grafico) */}
              <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:row-span-3 lg:self-start">
                <ControlPanel
                  config={config}
                  onChangeConfig={setConfig}
                  result={calculationResult}
                  onOpenPumpCatalogue={() => setIsPumpModalOpen(true)}
                  sourceIsSuctionPump={sourceMachine.isSuctionPump}
                  sourceHasDirectPump={sourceMachine.hasDirectPump}
                />
              </div>

              {/* Profilo Plano-Altimetrico */}
              <div className="lg:col-span-8 lg:col-start-1 lg:row-start-2">
                <ProfilePanel
                  profile={profile}
                  onChangeProfile={setProfile}
                  onOpenImport={() => setIsImportExportOpen(true)}
                  onOpenGps={() => setActiveTab('gps')}
                  highlightStationM={highlightStationM}
                  track={gpsTrack}
                  mapMarkers={mapMarkers}
                />
              </div>

              {/* Motopompe */}
              <div className="lg:col-span-8 lg:col-start-1 lg:row-start-3">
                <EquipmentPanel
                  equipment={equipment}
                  onChangeEquipment={setEquipment}
                  result={calculationResult}
                  pumpTypes={config.pumpTypes}
                  targetFlowLpm={config.targetFlowLpm}
                  highlightStationM={highlightStationM}
                  config={config}
                />
              </div>
            </div>

            {/* Pulsante finale: report stampabile della condotta */}
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setActiveTab('report')}
                className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg transition cursor-pointer"
              >
                <FileText className="w-4 h-4 mr-2" />
                Report Condotta (stampabile in PDF)
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modali */}
      <FileImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        profile={profile}
        equipment={equipment}
        track={gpsTrack}
        onImportProject={handleImportProject}
        result={calculationResult}
      />

      <PumpManagerModal
        isOpen={isPumpModalOpen}
        onClose={() => setIsPumpModalOpen(false)}
        pumpTypes={config.pumpTypes}
        onSavePumpTypes={handleSavePumpTypes}
      />
    </div>
  );
}
