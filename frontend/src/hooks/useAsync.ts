import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export interface EstadoAsync<T> {
  datos: T | null;
  cargando: boolean;
  error: Error | null;
}

/**
 * Ejecuta una función asíncrona al montar el componente y cada vez que cambian las dependencias, y devuelve
 * su estado (cargando / error / datos). Si una respuesta llega tarde y ya hay otra petición en curso, se descarta.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [estado, setEstado] = useState<EstadoAsync<T>>({ datos: null, cargando: true, error: null });
  const contador = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(() => {
    const id = ++contador.current;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    fn().then(
      (datos) => id === contador.current && setEstado({ datos, cargando: false, error: null }),
      (error: Error) => id === contador.current && setEstado({ datos: null, cargando: false, error }),
    );
  }, deps);

  useEffect(() => {
    ejecutar();
  }, [ejecutar]);

  return { ...estado, recargar: ejecutar };
}
