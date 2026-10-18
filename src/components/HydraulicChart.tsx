import React, { useMemo } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { CalculationResult, ProjectConfig, CalculatedPoint } from '../types';
import { BAR_TO_METERS } from '../engine/hydraulicEngine';

ChartJS.register(...registerables);

interface HydraulicChartProps {
  result: CalculationResult;
  config: ProjectConfig;
  onSelectStation?: (stationM: number) => void;
  /** Variante chiara, per il report stampabile su carta bianca. */
  variant?: 'dark' | 'light';
}

type PiezoRole = 'node' | 'inlet' | 'outlet' | 'crossing' | 'freeSurface';

interface PiezoVertex {
  x: number;
  y: number;
  z: number;
  role: PiezoRole;
  point?: CalculatedPoint;
}

const PIEZO_COLOR = '#38bdf8';

export const HydraulicChart: React.FC<HydraulicChartProps> = ({
  result,
  config,
  onSelectStation,
  variant = 'dark'
}) => {
  const points = result.points;
  const light = variant === 'light';

  /** Colori del grafico: scuri in app, chiari quando si stampa il report. */
  const theme = light
    ? {
        axisText: '#475569',
        axisTitle: '#334155',
        grid: 'rgba(100, 116, 139, 0.28)',
        legendText: '#334155',
        tooltipBg: 'rgba(255, 255, 255, 0.97)',
        tooltipTitle: '#0f172a',
        tooltipBody: '#334155',
        tooltipBorder: '#cbd5e1',
        pointBorder: '#ffffff'
      }
    : {
        axisText: '#94a3b8',
        axisTitle: '#94a3b8',
        grid: 'rgba(51, 65, 85, 0.4)',
        legendText: '#e2e8f0',
        tooltipBg: 'rgba(15, 23, 42, 0.95)',
        tooltipTitle: '#f8fafc',
        tooltipBody: '#cbd5e1',
        tooltipBorder: '#475569',
        pointBorder: '#ffffff'
      };

  const chartData = useMemo<any>(() => {
    if (points.length === 0) {
      return { datasets: [] };
    }

    // Punti profilo terreno
    const terrainData = points.map(p => ({
      x: p.distanceM,
      y: p.elevationZ
    }));

    // Punti limite pressione massima ammissibile: Z(x) + P_max * BAR_TO_METERS
    const maxPressureData = points.map(p => ({
      x: p.distanceM,
      y: p.elevationZ + config.maxLinePressureBar * BAR_TO_METERS
    }));

    // ------------------------------------------------------------------
    // COSTRUZIONE LINEA PIEZOMETRICA CON SALTI VERTICALI E INTERRUZIONI
    // ------------------------------------------------------------------
    // Per ogni nodo si distinguono la quota energetica in INGRESSO (prima
    // dell'eventuale pompa) e in USCITA (dopo la spinta). In questo modo:
    //   - una motopompa genera un SALTO VERTICALE verso l'alto (+ΔH)
    //   - la bocca di una motopompa che pesca a pelo libero porta la
    //     piezometrica sulla superficie della vasca (P = 0 bar): la condotta vi
    //     scarica il carico residuo e da lì riparte il salto della pompa
    //   - dove la piezometrica scende sotto il profilo del terreno (pressione
    //     negativa) la linea viene INTERROTTA contro la linea della quota.
    const vertices: PiezoVertex[] = [];
    points.forEach(p => {
      const freeSurface = p.freeSurfaceM;
      const hIn =
        freeSurface !== undefined ? freeSurface : p.elevationZ + p.inletPressureBar * BAR_TO_METERS;
      const hOut = p.hydraulicGradeH; // quota piezometrica in uscita dal nodo [m]
      const zIn = freeSurface !== undefined ? freeSurface : p.elevationZ;

      vertices.push({
        x: p.distanceM,
        y: hIn,
        z: zIn,
        role: freeSurface !== undefined ? 'freeSurface' : 'inlet',
        point: p
      });
      if (Math.abs(hOut - hIn) > 1e-6) {
        vertices.push({ x: p.distanceM, y: hOut, z: p.elevationZ, role: 'outlet', point: p });
      }
    });

    // Ritaglio contro il profilo del terreno: la piezometrica non può scendere
    // sotto la quota del terreno (pressione negativa -> collasso manichetta).
    // Ogni tratto continuo in pressione positiva diventa una polilinea separata.
    const segments: PiezoVertex[][] = [];
    let current: PiezoVertex[] = [];
    const startAt = (v: PiezoVertex) => {
      if (current.length === 0) current.push(v);
    };
    const breakLine = () => {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    };

    if (vertices.length === 1) {
      startAt(vertices[0]);
    }

    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i];
      const b = vertices[i + 1];
      const da = a.y - a.z; // carico disponibile sopra il terreno agli estremi
      const db = b.y - b.z;

      if (da >= 0 && db >= 0) {
        // Tratto interamente in pressione positiva
        startAt(a);
        current.push(b);
      } else if (da < 0 && db < 0) {
        // Tratto interamente in depressione: linea interrotta
        breakLine();
      } else {
        // Il tratto attraversa la linea del terreno: si interrompe esattamente
        // nel punto di intersezione (P = 0 bar).
        const t = da / (da - db);
        const crossX = a.x + t * (b.x - a.x);
        const crossZ = a.z + t * (b.z - a.z);

        if (da >= 0) {
          // esce dal terreno verso il basso: termina contro la quota
          startAt(a);
          current.push({ x: crossX, y: crossZ, z: crossZ, role: 'crossing' });
          breakLine();
        } else {
          // riemerge dal terreno: riparte dalla quota
          startAt({ x: crossX, y: crossZ, z: crossZ, role: 'crossing' });
          current.push(b);
        }
      }
    }
    breakLine();

    // Punti speciali per le pompe
    const pumpData = points
      .filter(p => p.node.type === 'pump')
      .map(p => ({
        x: p.distanceM,
        y: p.hydraulicGradeH,
        pumpType: p.node.pumpConfig?.pumpTypeId,
        boost: p.pumpBoostBar
      }));

    // Punti speciali per i peli liberi di aspirazione (vasche, fiumi, piscine
    // da cui pesca una motopompa): è la superficie a P = 0 bar.
    const freeSurfaceData = points
      .filter(p => p.freeSurfaceM !== undefined)
      .map(p => ({
        x: p.distanceM,
        y: p.freeSurfaceM as number
      }));

    const pointRadiusFn = (ctx: any) => {
      const raw = ctx.raw;
      if (!raw || raw.role === 'crossing' || raw.role === 'freeSurface') return 0;
      const p: CalculatedPoint | undefined = raw.point;
      if (!p) return 0;
      if (p.node.type === 'pump') return raw.role === 'outlet' ? 8 : 5;
      if (p.status === 'danger') return 5;
      return 3;
    };

    const pointColorFn = (ctx: any) => {
      const raw = ctx.raw;
      if (!raw) return PIEZO_COLOR;
      const p: CalculatedPoint | undefined = raw.point;
      if (!p) return PIEZO_COLOR;
      if (p.node.type === 'pump') {
        return p.isPumpOverloaded ? '#ef4444' : '#eab308';
      }
      if (p.status === 'danger') return '#ef4444';
      if (p.status === 'warning') return '#f97316';
      return PIEZO_COLOR;
    };

    const datasets: any[] = [];

    // Una polilinea (dataset) per ogni tratto continuo della piezometrica.
    segments.forEach((seg, idx) => {
      datasets.push({
        __kind: 'piezo',
        __noLegend: idx > 0,
        label: 'Linea Piezometrica H (Energia Totale)',
        data: seg,
        borderColor: PIEZO_COLOR,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        borderWidth: 3,
        borderJoinStyle: 'round',
        pointRadius: pointRadiusFn,
        pointBackgroundColor: pointColorFn,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        tension: 0,
        fill: false
      });
    });

    datasets.push({
      __kind: 'maxp',
      label: `Limite Pressione Max Tubo (+${config.maxLinePressureBar} bar)`,
      data: maxPressureData,
      borderColor: 'rgba(239, 68, 68, 0.65)',
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false
    });

    datasets.push({
      __kind: 'terrain',
      label: 'Profilo Terreno Z',
      data: terrainData,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.25)',
      borderWidth: 2.5,
      pointRadius: 2,
      pointBackgroundColor: '#10b981',
      fill: true,
      tension: 0
    });

    datasets.push({
      __kind: 'pump',
      label: 'Motopompe',
      data: pumpData,
      borderColor: '#eab308',
      backgroundColor: '#eab308',
      pointStyle: 'triangle',
      pointRadius: 10,
      showLine: false
    });

    datasets.push({
      __kind: 'freeSurface',
      label: 'Pelo Libero (aspirazione)',
      data: freeSurfaceData,
      borderColor: '#06b6d4',
      backgroundColor: '#06b6d4',
      pointStyle: 'rectRot',
      pointRadius: 9,
      showLine: false
    });

    return { datasets };
  }, [points, config]);

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 250
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    onClick: (_e: any, elements: any[]) => {
      if (elements && elements.length > 0 && onSelectStation) {
        const el = elements[0];
        const ds = chartData.datasets?.[el.datasetIndex];
        const raw = ds?.data?.[el.index];
        const distanceM = raw?.point?.distanceM ?? points[el.index]?.distanceM;
        if (distanceM != null) {
          onSelectStation(distanceM);
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: theme.legendText,
          font: {
            size: 11,
            weight: '500'
          },
          usePointStyle: true,
          boxWidth: 8,
          filter: (item: any, data: any) => !data.datasets[item.datasetIndex]?.__noLegend
        }
      },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.tooltipTitle,
        bodyColor: theme.tooltipBody,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          title: (items: any[]) => {
            if (!items.length) return '';
            const first = items[0];
            const dm =
              first.raw?.point?.distanceM ?? points[first.dataIndex]?.distanceM;
            if (dm == null) return `Progressiva Reale: ${first.parsed.x.toFixed(1)} m`;
            return `Distanza Reale Condotta: ${dm.toFixed(1)} m`;
          },
          label: (item: any) => {
            const kind = item.dataset?.__kind;

            // Linea piezometrica: usa i metadati allegati al vertice
            if (kind === 'piezo') {
              const raw = item.raw;
              if (!raw) return '';
              if (raw.role === 'crossing') {
                return 'Interruzione linea: raggiunta la quota terreno (P = 0 bar)';
              }
              const pt: CalculatedPoint | undefined = raw.point;
              if (!pt) return `Quota Piezometrica H: ${raw.y.toFixed(1)} m`;
              if (raw.role === 'freeSurface') {
                const lift = pt.node.pumpConfig?.suctionLiftM ?? 0;
                return [
                  `Pelo libero: ${raw.y.toFixed(1)} m s.l.m. (P = 0 bar)`,
                  `Altezza di aspirazione H_asp: ${lift.toFixed(1)} m`,
                  `Pressione di arrivo dal tratto a monte: ${pt.inletPressureBar.toFixed(2)} bar`,
                  pt.statusMessage ? `⚠️ Note: ${pt.statusMessage}` : ''
                ].filter(Boolean);
              }
              const tag = raw.role === 'outlet' ? 'USCITA nodo' : 'INGRESSO nodo';
              return [
                `Quota Piezometrica H [${tag}]: ${raw.y.toFixed(1)} m`,
                `Pressione in Ingresso (P_in): ${pt.inletPressureBar.toFixed(2)} bar`,
                `Pressione in Uscita (P_out): ${pt.outletPressureBar.toFixed(2)} bar`,
                `Quota Terreno Z: ${pt.elevationZ.toFixed(1)} m`,
                `Perdita Cumulata Tratta: ${pt.cumulativeLossM.toFixed(1)} m`,
                pt.statusMessage ? `⚠️ Note: ${pt.statusMessage}` : ''
              ].filter(Boolean);
            }

            const idx = item.dataIndex;
            const pt = points[idx];
            if (!pt) return `${item.dataset.label}: ${item.parsed.y.toFixed(1)} m`;

            if (kind === 'maxp') {
              return `Soglia Sovrapressione: ${(pt.elevationZ + config.maxLinePressureBar * BAR_TO_METERS).toFixed(1)} m (${config.maxLinePressureBar} bar)`;
            } else if (kind === 'terrain') {
              return `Quota Terreno: ${pt.elevationZ.toFixed(1)} m s.l.m.`;
            }
            return `${item.dataset.label}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Lunghezza Reale / Diagonale Condotta [metri]',
          color: theme.axisTitle,
          font: { size: 12, weight: '600' }
        },
        grid: {
          color: theme.grid
        },
        ticks: {
          color: theme.axisText,
          font: { size: 11 }
        }
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Quota Altimetrica ed Energetica [metri s.l.m.]',
          color: theme.axisTitle,
          font: { size: 12, weight: '600' }
        },
        grid: {
          color: theme.grid
        },
        ticks: {
          color: theme.axisText,
          font: { size: 11 }
        }
      }
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col rounded-xl border p-3 ${
        light
          ? 'bg-white border-slate-300'
          : 'bg-slate-900/90 border-slate-800 shadow-xl'
      }`}
    >
      <div
        className={`flex items-center justify-between px-2 pb-2 border-b mb-2 ${
          light ? 'border-slate-300' : 'border-slate-800'
        }`}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-sky-400 animate-pulse"></div>
          <h3
            className={`text-sm font-semibold uppercase tracking-wider ${
              light ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            Profilo Altimetrico e Linea Piezometrica
          </h3>
        </div>
        <div
          className={`text-xs flex items-center space-x-3 ${
            light ? 'text-slate-600' : 'text-slate-400'
          }`}
        >
          <span className="flex items-center space-x-1">
            <span className="inline-block w-2.5 h-2.5 bg-yellow-400 rotate-45 mr-1"></span>
            Motopompa
          </span>
          <span className="flex items-center space-x-1">
            <span className="inline-block w-2.5 h-2.5 bg-cyan-400 mr-1"></span>
            Pelo Libero
          </span>
          <span className="flex items-center space-x-1">
            <span className="inline-block w-2.5 h-2.5 border-t-2 border-red-500 border-dashed mr-1"></span>
            P. Max Manichetta
          </span>
        </div>
      </div>
      <div className="relative flex-1 min-h-[360px] w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};
