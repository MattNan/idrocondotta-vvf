import React from 'react';
import { PumpType } from '../types';
import {
  generatePumpCurveData,
  calculatePumpDeliveryPressure
} from '../engine/pumpCatalogue';
import { Gauge, Sliders } from 'lucide-react';

interface PumpCurvePreviewProps {
  pump: PumpType;
  currentFlowLpm: number;
  regulatedBoostBar?: number;
  onRegulateBoost?: (val: number) => void;
  compact?: boolean;
}

export const PumpCurvePreview: React.FC<PumpCurvePreviewProps> = ({
  pump,
  currentFlowLpm,
  regulatedBoostBar,
  onRegulateBoost,
  compact = false
}) => {
  const curvePoints = generatePumpCurveData(pump, 25);
  const operatingPoint = calculatePumpDeliveryPressure(pump, currentFlowLpm, regulatedBoostBar);

  const maxQ = Math.max(...curvePoints.map(pt => pt.q));
  const maxP = Math.max(...curvePoints.map(pt => pt.p)) * 1.1;

  // Coordinate SVG
  const width = compact ? 240 : 340;
  const height = compact ? 120 : 160;
  const padding = { top: 14, right: 15, bottom: 22, left: 32 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const getX = (q: number) => padding.left + (q / maxQ) * plotWidth;
  const getY = (p: number) => padding.top + plotHeight - (p / maxP) * plotHeight;

  // Path SVG per la curva
  const pathD = curvePoints.reduce((acc, pt, idx) => {
    const x = getX(pt.q);
    const y = getY(pt.p);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Coordinate punto nominale
  const nomX = getX(pump.nominalFlowLpm);
  const nomY = getY(pump.nominalHeadBar);

  // Coordinate punto max curva alla portata attuale
  const curQClamped = Math.min(currentFlowLpm, maxQ);
  const curX = getX(curQClamped);
  const curYMaxCurve = getY(operatingPoint.maxCurvePressureBar);
  const curYRegulated = getY(operatingPoint.effectiveBoostBar);

  const statusColor = operatingPoint.isOverloaded
    ? '#ef4444' // Rosso sovraccarico
    : operatingPoint.isOverNominal
    ? '#f59e0b' // Ambra oltre targa
    : '#10b981'; // Verde ottimale

  return (
    <div className={`bg-slate-950 border border-slate-800 rounded-xl ${compact ? 'p-2.5' : 'p-3.5'} shadow-xl max-w-md w-full`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-slate-200 flex items-center">
          <Gauge className="w-3.5 h-3.5 mr-1 text-amber-400" />
          Curva P-Q: {pump.name}
        </span>
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded"
          style={{ backgroundColor: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}66` }}
        >
          {operatingPoint.isOverloaded
            ? 'SOVRACCARICO (Q > Qmax)'
            : operatingPoint.isThrottled
            ? 'MANDATA REGOLATA'
            : operatingPoint.isOverNominal
            ? 'OLTRE TARGA'
            : '100% ACCELERATORE'}
        </span>
      </div>

      <div className="relative flex justify-center">
        <svg width={width} height={height} className="overflow-visible font-mono text-[9px]">
          {/* Asse X e Y */}
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={width - padding.right}
            y2={padding.top + plotHeight}
            stroke="#475569"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Griglia orizzontale / etichette Pressione */}
          <text x={padding.left - 4} y={getY(pump.nominalHeadBar) + 3} textAnchor="end" fill="#94a3b8">
            {pump.nominalHeadBar}b
          </text>
          <line
            x1={padding.left}
            y1={getY(pump.nominalHeadBar)}
            x2={width - padding.right}
            y2={getY(pump.nominalHeadBar)}
            stroke="#334155"
            strokeDasharray="2 2"
          />

          {/* Griglia verticale / etichetta Portata Nominale */}
          <text x={nomX} y={padding.top + plotHeight + 14} textAnchor="middle" fill="#94a3b8">
            {pump.nominalFlowLpm}
          </text>
          <line
            x1={nomX}
            y1={padding.top}
            x2={nomX}
            y2={padding.top + plotHeight}
            stroke="#334155"
            strokeDasharray="2 2"
          />

          {/* Curva caratteristica teorica EN 1028 */}
          <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

          {/* Punto nominale (punto di targa) */}
          <circle cx={nomX} cy={nomY} r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />

          {/* Linea verticale sulla portata attuale Q */}
          <line
            x1={curX}
            y1={padding.top}
            x2={curX}
            y2={padding.top + plotHeight}
            stroke={statusColor}
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />

          {/* Punto max teorico da curva */}
          <circle cx={curX} cy={curYMaxCurve} r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />

          {/* Tratto tratteggiato verso il punto regolato se strozzato */}
          {operatingPoint.isThrottled && (
            <line
              x1={curX}
              y1={curYMaxCurve}
              x2={curX}
              y2={curYRegulated}
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="2 2"
            />
          )}

          {/* Punto di lavoro regolato effettivo */}
          <circle cx={curX} cy={curYRegulated} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Regolazione Slider dell'Acceleratore/Pressione Mandata */}
      {onRegulateBoost && (
        <div className="mt-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-300 font-semibold flex items-center">
              <Sliders className="w-3 h-3 mr-1 text-amber-400" />
              Regolazione Pressione Mandata (0 - Max Curva):
            </span>
            <div className="flex items-center space-x-1.5 font-mono">
              <span className="font-bold text-amber-300">
                {operatingPoint.effectiveBoostBar.toFixed(1)} bar
              </span>
              <button
                type="button"
                onClick={() => onRegulateBoost(operatingPoint.maxCurvePressureBar)}
                className="px-1.5 py-0.2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded text-[9px] font-bold border border-slate-700 transition"
                title="Ripristina al 100% della curva"
              >
                100% MAX
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-slate-500 font-mono">0 bar</span>
            <input
              type="range"
              min="0"
              max={operatingPoint.maxCurvePressureBar}
              step="0.1"
              value={operatingPoint.effectiveBoostBar}
              onChange={e => onRegulateBoost(Number(e.target.value))}
              className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-sky-400 font-mono">
              {operatingPoint.maxCurvePressureBar.toFixed(1)} bar
            </span>
          </div>
        </div>
      )}

      {/* Dati operativi riassuntivi */}
      <div className="mt-2 pt-1.5 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[10px] font-mono text-center">
        <div>
          <span className="text-slate-400 block">Q Progetto</span>
          <span className="font-bold text-slate-100">{currentFlowLpm} l/min</span>
        </div>
        <div>
          <span className="text-slate-400 block">Max Curva (100%)</span>
          <span className="font-bold text-sky-400">
            {operatingPoint.maxCurvePressureBar.toFixed(2)} bar
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Erogata Regolata</span>
          <span className="font-bold text-amber-300">
            {operatingPoint.effectiveBoostBar.toFixed(2)} bar
          </span>
        </div>
      </div>
    </div>
  );
};
