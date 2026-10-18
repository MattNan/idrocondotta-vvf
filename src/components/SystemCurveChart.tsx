import React, { useMemo } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SystemCurveSection } from '../types';

ChartJS.register(...registerables);

interface SystemCurveChartProps {
  section: SystemCurveSection;
  /** Portata di progetto, per la linea verticale di riferimento. */
  targetFlowLpm: number;
}

const COLOR_DEMAND = '#38bdf8';
const COLOR_SUPPLY = '#eab308';
const COLOR_OPERATING = '#22d3ee';
const COLOR_DESIGN = 'rgba(148, 163, 184, 0.75)';
const COLOR_PUMP_LIMIT = 'rgba(239, 68, 68, 0.85)';

/**
 * Arrotonda il tetto della scala a un valore "da grafico", per non avere
 * etichette con decimali.
 */
function niceCeil(value: number): number {
  if (value <= 40) return Math.ceil(value / 5) * 5;
  if (value <= 120) return Math.ceil(value / 10) * 10;
  if (value <= 400) return Math.ceil(value / 20) * 20;
  return Math.ceil(value / 50) * 50;
}

export const SystemCurveChart: React.FC<SystemCurveChartProps> = ({ section, targetFlowLpm }) => {
  /** Tetto della scala delle prevalenze: le due curve, con un po' di respiro. */
  const yMax = useMemo(() => {
    const peak = section.curve.reduce((max, sample) => Math.max(max, sample.demandM, sample.supplyM), 0);
    return niceCeil(peak * 1.06);
  }, [section.curve]);

  const chartData = useMemo<any>(() => {
    const curve = section.curve;
    const operatingPoint =
      section.operatingFlowLpm !== null && section.operatingHeadM !== null
        ? [{ x: section.operatingFlowLpm, y: section.operatingHeadM }]
        : [];

    const datasets: any[] = [
      {
        label: 'Impianto',
        data: curve.map(sample => ({ x: sample.qLpm, y: sample.demandM })),
        borderColor: COLOR_DEMAND,
        backgroundColor: COLOR_DEMAND,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0,
        fill: false,
        order: 1
      },
      {
        label: 'Pompe in serie',
        data: curve.map(sample => ({ x: sample.qLpm, y: sample.supplyM })),
        borderColor: COLOR_SUPPLY,
        backgroundColor: COLOR_SUPPLY,
        borderWidth: 2.5,
        borderDash: [7, 4],
        pointRadius: 0,
        tension: 0,
        fill: false,
        order: 2
      },
      {
        __noTooltip: true,
        label: 'Progetto',
        data: [
          { x: targetFlowLpm, y: 0 },
          { x: targetFlowLpm, y: yMax }
        ],
        borderColor: COLOR_DESIGN,
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        order: 4
      }
    ];

    if (section.pumpsMaxFlowLpm !== null && section.pumpsMaxFlowLpm <= section.chartQMax) {
      datasets.push({
        __noTooltip: true,
        label: 'Q max pompe',
        data: [
          { x: section.pumpsMaxFlowLpm, y: 0 },
          { x: section.pumpsMaxFlowLpm, y: yMax }
        ],
        borderColor: COLOR_PUMP_LIMIT,
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        fill: false,
        order: 3
      });
    }

    if (operatingPoint.length > 0) {
      datasets.push({
        label: 'Punto di lavoro',
        data: operatingPoint,
        borderColor: '#ffffff',
        backgroundColor: COLOR_OPERATING,
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false,
        order: 0
      });
    }

    return { datasets };
  }, [section, targetFlowLpm, yMax]);

  const operating = section.operatingFlowLpm;

  const options: any = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 180 },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#e2e8f0',
            boxWidth: 8,
            boxHeight: 8,
            padding: 8,
            font: { size: 10, weight: '500' },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: '#475569',
          borderWidth: 1,
          padding: 10,
          boxPadding: 5,
          usePointStyle: true,
          // Le due linee verticali di riferimento non sono valori da leggere.
          filter: (item: any) => !item.dataset.__noTooltip,
          callbacks: {
            title: (items: any[]) => {
              if (!items.length) return '';
              return 'Portata ' + Math.round(items[0].parsed.x) + ' l/min';
            },
            label: (item: any) => {
              const names: Record<string, string> = {
                Impianto: "Richiesta dall'impianto",
                'Pompe in serie': 'Fornita dalle pompe in serie',
                'Punto di lavoro': 'Punto di lavoro'
              };
              const name = names[item.dataset.label] ?? item.dataset.label;
              if (item.dataset.label === 'Punto di lavoro') {
                return name + ' ' + Math.round(item.parsed.x) + ' l/min · ' + item.parsed.y.toFixed(1) + ' m';
              }
              return name + ': ' + item.parsed.y.toFixed(1) + ' m';
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: section.chartQMax,
          title: {
            display: true,
            text: 'Portata [l/min]',
            color: '#94a3b8',
            font: { size: 11, weight: '600' }
          },
          grid: { color: 'rgba(51, 65, 85, 0.4)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            maxTicksLimit: 7
          }
        },
        y: {
          type: 'linear',
          min: 0,
          max: yMax,
          title: {
            display: true,
            text: 'Prevalenza [m]',
            color: '#94a3b8',
            font: { size: 11, weight: '600' }
          },
          grid: { color: 'rgba(51, 65, 85, 0.4)' },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        }
      }
    }),
    [section.chartQMax, yMax]
  );

  return (
    <div className="w-full">
      <div className="relative h-[260px] w-full sm:h-[285px]">
        <Line data={chartData} options={options} />
      </div>
      {operating === null && (
        <p className="mt-1 text-center text-[10px] text-red-300">
          A valvole chiuse la prevalenza delle pompe non copre il dislivello richiesto.
        </p>
      )}
    </div>
  );
};
