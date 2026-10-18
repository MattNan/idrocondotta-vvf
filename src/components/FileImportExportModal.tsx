import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { ProfilePoint, EquipmentItem, CalculationResult, GpsTrackPoint } from '../types';
import {
  parseProjectFile,
  exportProjectToCSV,
  exportCalculationReportToCSV,
  downloadTextFile,
  ParsedProjectData
} from '../utils/fileParser';

interface FileImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfilePoint[];
  equipment: EquipmentItem[];
  /** Percorso GPS a piena risoluzione (con latitudine e longitudine), se presente. */
  track?: GpsTrackPoint[];
  onImportProject: (data: ParsedProjectData) => void;
  result: CalculationResult;
}

export const FileImportExportModal: React.FC<FileImportExportModalProps> = ({
  isOpen,
  onClose,
  profile,
  equipment,
  track,
  onImportProject,
  result
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setError(null);
    setSuccess(null);
    setIsProcessing(true);

    try {
      const parsed = await parseProjectFile(file);
      onImportProject(parsed);
      setSuccess(
        `Importati ${parsed.profile.length} punti di profilo, ${parsed.equipment.length} macchine` +
          (parsed.track && parsed.track.length > 0 ? ` e ${parsed.track.length} punti GPS` : '') +
          ` da "${file.name}"!`
      );
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Errore durante la lettura del file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadSampleTemplate = () => {
    const templateContent = [
      '# SEZIONE 1 - MOTOPOMPE',
      'Progressiva [m],Quota Z [m],Tipo,Modello Pompa,Modalita,Altezza Aspirazione [m],Delta P regolata [bar],Note',
      '370,515,motopompa,pump-8-8,direct,,,"Motopompa di rilancio in diretta"',
      '695,587,motopompa,pump-12-10,vascone_suction,2.5,,"Rilancio 12/10 che aspira a pelo libero (vascone, fiume, vasca)"',
      '',
      '# SEZIONE 2 - PROFILO PLANO-ALTIMETRICO',
      'Progressiva [m],Quota Z [m],Latitudine,Longitudine,Note',
      '0,420,,,"Presa d\'acqua sorgente"',
      '105,445,,,',
      '235,480,,,',
      '370,515,,,',
      '510,550,,,',
      '690,585,,,',
      '695,587,,,',
      '830,615,,,',
      '960,640,,,"Lancia terminale antincendio"',
      '',
      '# SEZIONE 3 - PERCORSO GPS (LATITUDINE / LONGITUDINE)  [opzionale]',
      'Progressiva [m],Latitudine,Longitudine,Quota Z [m]'
    ].join('\n');

    downloadTextFile(templateContent, 'modello_profilo_dotazione_vvf.csv');
  };

  const handleExportProfile = () => {
    const csv = exportProjectToCSV(profile, equipment, track);
    downloadTextFile(csv, `profilo_e_dotazione_${Date.now()}.csv`);
  };

  const handleExportReport = () => {
    const csv = exportCalculationReportToCSV(result);
    downloadTextFile(csv, `relazione_idraulica_piezometrica_${Date.now()}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Carica / Esporta Dati Profilo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Messages */}
          {error && (
            <div className="bg-red-950/60 border border-red-700 text-red-200 text-xs p-3 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs p-3 rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Importa da file CSV o Excel (.xlsx, .xls)
            </label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl p-6 text-center transition cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <Upload className="w-8 h-8 mx-auto text-sky-400 mb-2" />
              <div className="text-sm font-semibold text-slate-200">
                {isProcessing ? 'Elaborazione file in corso...' : 'Trascina qui il file o fai click per sfogliare'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Puoi caricare il file completo (pompe + profilo) oppure il solo profilo (Progressiva, Quota Z)
              </div>
            </div>
          </div>

          {/* Template Download */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Non hai un file pronto? Scarica il file d'esempio:
            </span>
            <button
              onClick={handleDownloadSampleTemplate}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium underline flex items-center space-x-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span>Scarica Modello CSV</span>
            </button>
          </div>

          {/* Export Options */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Esporta Dati del Progetto Attuale
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleExportProfile}
                className="p-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition flex items-center space-x-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <div className="text-left">
                  <div className="font-semibold">Esporta Progetto (CSV)</div>
                  <div className="text-[10px] text-slate-400">Motopompe e profilo plano-altimetrico</div>
                </div>
              </button>

              <button
                onClick={handleExportReport}
                className="p-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium transition flex items-center space-x-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-sky-400" />
                <div className="text-left">
                  <div className="font-semibold">Esporta Relazione Completa</div>
                  <div className="text-[10px] text-slate-400">Piezometriche, pressioni e perdite</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
