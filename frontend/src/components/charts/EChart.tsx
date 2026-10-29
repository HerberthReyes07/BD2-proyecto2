import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

/** Envoltorio mínimo de ECharts: crea la gráfica, la actualiza al cambiar `opcion` y la ajusta al tamaño del contenedor. */
export function EChart({ opcion, alto = 380 }: { opcion: echarts.EChartsOption; alto?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const grafica = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const c = echarts.init(caja.current!);
    grafica.current = c;
    const observador = new ResizeObserver(() => c.resize());
    observador.observe(caja.current!);
    return () => {
      observador.disconnect();
      c.dispose();
      grafica.current = null;
    };
  }, []);

  useEffect(() => {
    grafica.current?.setOption(opcion, true);
  }, [opcion]);

  return <div ref={caja} style={{ width: '100%', height: alto }} role="img" aria-label="Gráfica del resultado" />;
}
