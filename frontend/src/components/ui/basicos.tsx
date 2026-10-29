import { ReactNode, useState } from 'react';
import { ApiError } from '../../api/client';
import { celda, etiqueta } from '../../utils/formato';
import { Fila } from '../../types/api';

/** Convierte los fragmentos entre acentos graves (`así`) en código en línea. */
export function TextoConCodigo({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(`[^`]+`)/g).map((trozo, i) =>
        trozo.startsWith('`') && trozo.endsWith('`') ? <code key={i}>{trozo.slice(1, -1)}</code> : <span key={i}>{trozo}</span>,
      )}
    </>
  );
}

export function Spinner({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="spinner-caja" role="status">
      <span className="spinner" />
      <span>{texto}</span>
    </div>
  );
}

/** Muestra un error de la API de forma clara: mensaje legible y, si existe, el detalle técnico plegado. */
export function ErrorAlert({ error, alReintentar }: { error: Error; alReintentar?: () => void }) {
  const api = error instanceof ApiError ? error : null;
  return (
    <div className="alerta alerta-error" role="alert">
      <strong>{api?.codigo === 'SIN_CONEXION' ? 'Sin conexión' : 'No se pudo completar la operación'}</strong>
      <p>{error.message}</p>
      {api?.detalle ? (
        <details>
          <summary>Detalle técnico</summary>
          <pre>{typeof api.detalle === 'string' ? api.detalle : JSON.stringify(api.detalle, null, 2)}</pre>
        </details>
      ) : null}
      {alReintentar && (
        <button className="btn btn-secundario" onClick={alReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Insignia({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'ok' | 'aviso' | 'error' | 'info' }) {
  return <span className={`insignia insignia-${tono}`}>{children}</span>;
}

const TONO_ESTADO: Record<string, 'ok' | 'aviso' | 'error' | 'info' | 'neutro'> = {
  COMPLETADA: 'ok',
  COMPLETADA_CON_ERRORES: 'aviso',
  FALLIDA: 'error',
  EN_PROCESO: 'info',
  OMITIDA: 'neutro',
  APROBADO: 'ok',
  YA_HABILITADO: 'info',
  PARCIAL: 'aviso',
  NO_APROBADO: 'neutro',
};

export function InsigniaEstado({ estado }: { estado: string }) {
  return <Insignia tono={TONO_ESTADO[estado] ?? 'neutro'}>{estado.replace(/_/g, ' ').toLowerCase()}</Insignia>;
}

export function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-titulo">{titulo}</span>
      <strong className="kpi-valor">{valor}</strong>
      {nota && <span className="kpi-nota">{nota}</span>}
    </div>
  );
}

export function Pestanias<T extends string>({ opciones, activa, alCambiar }: { opciones: { id: T; texto: string }[]; activa: T; alCambiar: (id: T) => void }) {
  return (
    <div className="pestanias" role="tablist">
      {opciones.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === activa} className={o.id === activa ? 'pestania activa' : 'pestania'} onClick={() => alCambiar(o.id)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Bloque de código plegable (pipeline de MongoDB o Cypher). */
export function Codigo({ titulo, codigo }: { titulo: string; codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <details className="codigo">
      <summary>{titulo}</summary>
      <button
        className="btn btn-secundario btn-chico"
        onClick={() => {
          void navigator.clipboard?.writeText(codigo).then(() => {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          });
        }}
      >
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
      <pre>{codigo}</pre>
    </details>
  );
}

/** Tabla genérica: columnas = claves de la primera fila. */
export function TablaDatos({ filas, maxFilas = 500 }: { filas: Fila[]; maxFilas?: number }) {
  if (filas.length === 0) return <p className="vacio">La consulta no devolvió filas.</p>;
  const columnas = Object.keys(filas[0]);
  const visibles = filas.slice(0, maxFilas);
  return (
    <div className="tabla-caja">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{etiqueta(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibles.map((fila, i) => (
            <tr key={i}>
              {columnas.map((c) => (
                <td key={c} className={typeof fila[c] === 'number' ? 'num' : undefined}>
                  {celda(fila[c], c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length > maxFilas && <p className="nota">Se muestran las primeras {maxFilas} de {filas.length} filas.</p>}
    </div>
  );
}
