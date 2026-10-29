import type { EChartsOption } from 'echarts';
import { ConsultaMeta, Fila } from '../../types/api';
import { esPorcentaje, etiqueta, num } from '../../utils/formato';

// Paleta de 14 colores distinguibles (hay consultas con 14 carreras)
export const PALETA = [
  '#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899',
  '#84cc16', '#f97316', '#64748b', '#14b8a6', '#a855f7', '#eab308', '#0ea5e9',
];

const unicos = (valores: unknown[]): unknown[] => [...new Set(valores)];
const numero = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * Traduce los metadatos de una consulta (tipo de gráfica y ejes) y sus filas a una configuración de ECharts.
 * Devuelve null si la consulta no se grafica (tablas y detalles).
 */
export function construirOpcion(meta: ConsultaMeta, filas: Fila[]): EChartsOption | null {
  const { grafica, ejes } = meta;
  if (!ejes || !ejes.x || !ejes.y || grafica === 'tabla' || grafica === 'detalle' || filas.length === 0) return null;
  const x = ejes.x;
  const ys = ejes.y;

  // ---- Pastel ----
  if (grafica === 'pastel') {
    return {
      color: PALETA,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['38%', '68%'],
          label: { formatter: '{b}\n{d}%' },
          data: filas.map((f) => ({ name: String(f[x]), value: numero(f[ys[0]]) ?? 0 })),
        },
      ],
    };
  }

  const categorias = unicos(filas.map((f) => f[x]));
  const esLinea = grafica === 'lineas';
  const apilada = grafica === 'barras_apiladas';
  const porcentaje = esPorcentaje(ys[0]);

  // Una serie por cada valor de `serie` (por ejemplo, una por carrera) o una por cada métrica en `y`
  let series: { name: string; data: (number | null)[] }[];
  if (ejes.serie) {
    const nombres = unicos(filas.map((f) => f[ejes.serie!]));
    const indice = new Map<string, number | null>();
    for (const f of filas) indice.set(`${String(f[x])}\u0000${String(f[ejes.serie!])}`, numero(f[ys[0]]));
    series = nombres.map((n) => ({
      name: String(n),
      data: categorias.map((c) => indice.get(`${String(c)}\u0000${String(n)}`) ?? null),
    }));
  } else {
    const indice = new Map<string, Fila>();
    for (const f of filas) indice.set(String(f[x]), f);
    series = ys.map((y) => ({ name: etiqueta(y), data: categorias.map((c) => numero(indice.get(String(c))?.[y])) }));
  }

  // Si los nombres de categoría son largos (carreras, municipios) se dibujan barras horizontales
  const largo = Math.max(...categorias.map((c) => String(c).length));
  const horizontal = !esLinea && largo > 14 && categorias.length <= 30;
  const etiquetasValor = series.length === 1 && categorias.length <= 15;
  const sufijo = porcentaje ? '%' : '';

  const ejeCategorias = {
    type: 'category' as const,
    data: categorias.map(String),
    axisLabel: horizontal ? { width: 190, overflow: 'truncate' as const } : { rotate: categorias.length > 12 ? 45 : 0, hideOverlap: true },
    inverse: horizontal,
  };
  const ejeValores = { type: 'value' as const, axisLabel: { formatter: (v: number) => `${num(v)}${sufijo}` } };

  const opcion: EChartsOption = {
    color: PALETA,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: esLinea ? 'line' : 'shadow' },
      valueFormatter: (v) => (typeof v === 'number' ? `${num(v)}${sufijo}` : '—'),
    },
    legend: series.length > 1 || ejes.linea ? { type: 'scroll', bottom: 0 } : undefined,
    grid: { left: horizontal ? 200 : 16, right: ejes.linea ? 56 : 24, top: 24, bottom: series.length > 1 || ejes.linea ? 48 : 16, containLabel: !horizontal },
    xAxis: horizontal ? ejeValores : ejeCategorias,
    yAxis: horizontal ? ejeCategorias : ejes.linea ? [ejeValores, { type: 'value' as const, axisLabel: { formatter: '{value}%' }, splitLine: { show: false } }] : ejeValores,
    series: series.map((s) => ({
      name: s.name,
      type: esLinea ? ('line' as const) : ('bar' as const),
      stack: apilada ? 'total' : undefined,
      smooth: false,
      symbolSize: 5,
      data: s.data,
      label: etiquetasValor ? { show: true, position: horizontal ? ('right' as const) : ('top' as const), formatter: (p: { value?: unknown }) => `${typeof p.value === 'number' ? num(p.value) : ''}${sufijo}` } : undefined,
    })),
  };

  // Línea secundaria sobre barras apiladas (por ejemplo, el porcentaje de aprobadas por año)
  if (ejes.linea && !horizontal) {
    const indice = new Map<string, Fila>();
    for (const f of filas) indice.set(String(f[x]), f);
    (opcion.series as unknown[]).push({
      name: etiqueta(ejes.linea),
      type: 'line',
      yAxisIndex: 1,
      symbolSize: 7,
      color: '#0f172a',
      data: categorias.map((c) => numero(indice.get(String(c))?.[ejes.linea!])),
      tooltip: { valueFormatter: (v: unknown) => (typeof v === 'number' ? `${num(v)}%` : '—') },
    });
  }
  return opcion;
}
