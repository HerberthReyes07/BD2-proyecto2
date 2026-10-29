import { useEffect, useMemo, useState } from 'react';
import { ConsultaMeta, ParametroDef, ResultadoConsulta } from '../types/api';
import { duracion, etiqueta, num } from '../utils/formato';
import { construirOpcion } from './charts/opcionesGrafica';
import { EChart } from './charts/EChart';
import { DetalleAspirante } from './DetalleAspirante';
import { Codigo, ErrorAlert, Insignia, Pestanias, Spinner, TablaDatos, TextoConCodigo } from './ui/basicos';

type Valores = Record<string, string>;

interface Props {
  consultas: ConsultaMeta[];
  ejecutar: (id: string, params: Record<string, unknown>) => Promise<ResultadoConsulta>;
  /** Valores para convertir un parámetro en lista desplegable (por ejemplo { anio_ingreso: [2015, ...] }). */
  opciones?: Record<string, (string | number)[]>;
  prefijo: string; // "Consulta" o "Consulta Cypher"
}

/**
 * Pantalla genérica para ejecutar y ver consultas: lista de consultas a la izquierda; a la derecha su descripción,
 * un formulario generado a partir de sus parámetros y el resultado como gráfica o tabla. Sirve igual para las
 * consultas de MongoDB y las de Neo4j, porque ambas devuelven filas y los mismos metadatos.
 */
export function QueryRunner({ consultas, ejecutar, opciones = {}, prefijo }: Props) {
  const [idActiva, setIdActiva] = useState(consultas[0]?.id ?? '');
  const [filtro, setFiltro] = useState('');
  const consulta = consultas.find((c) => c.id === idActiva) ?? consultas[0];

  const visibles = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return f ? consultas.filter((c) => `${c.numero} ${c.titulo}`.toLowerCase().includes(f)) : consultas;
  }, [consultas, filtro]);

  return (
    <div className="runner">
      <aside className="runner-lista">
        <input className="entrada" placeholder="Buscar consulta…" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar consulta" />
        <ol>
          {visibles.map((c) => (
            <li key={c.id}>
              <button className={c.id === consulta?.id ? 'item activo' : 'item'} onClick={() => setIdActiva(c.id)}>
                <span className="item-num">{c.numero}</span>
                <span>{c.titulo}</span>
              </button>
            </li>
          ))}
          {visibles.length === 0 && <li className="vacio">Sin coincidencias.</li>}
        </ol>
      </aside>
      <section className="runner-detalle">
        {consulta && <PanelConsulta key={consulta.id} consulta={consulta} ejecutar={ejecutar} opciones={opciones} prefijo={prefijo} />}
      </section>
    </div>
  );
}

function valoresIniciales(params: ParametroDef[]): Valores {
  return Object.fromEntries(params.map((p) => [p.nombre, p.por_defecto !== undefined ? String(p.por_defecto) : '']));
}

function PanelConsulta({ consulta, ejecutar, opciones = {}, prefijo }: { consulta: ConsultaMeta } & Omit<Props, 'consultas'>) {
  const [valores, setValores] = useState<Valores>(() => valoresIniciales(consulta.parametros));
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [vista, setVista] = useState<'grafica' | 'tabla'>('grafica');

  const faltan = consulta.parametros.filter((p) => p.requerido && !valores[p.nombre]?.trim());

  const correr = async (v: Valores) => {
    setCargando(true);
    setError(null);
    try {
      setResultado(await ejecutar(consulta.id, v));
    } catch (e) {
      setResultado(null);
      setError(e as Error);
    } finally {
      setCargando(false);
    }
  };

  // Las consultas sin parámetros obligatorios se ejecutan al abrirlas
  useEffect(() => {
    if (faltan.length === 0) void correr(valores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiar = (nombre: string, valor: string, automatico: boolean) => {
    const nuevos = { ...valores, [nombre]: valor };
    setValores(nuevos);
    if (automatico && consulta.parametros.every((p) => !p.requerido || nuevos[p.nombre]?.trim())) void correr(nuevos);
  };

  const opcion = useMemo(() => {
    if (!resultado) return null;
    try {
      return construirOpcion(resultado.consulta, resultado.filas);
    } catch (e) {
      console.error('No se pudo construir la gráfica:', e); // se muestra la tabla en su lugar
      return null;
    }
  }, [resultado]);
  const codigo = resultado?.pipeline ? JSON.stringify(resultado.pipeline, null, 2) : resultado?.cypher;

  return (
    <div>
      <header className="runner-cabecera">
        <h2>
          {prefijo} {consulta.numero} · {consulta.titulo}
        </h2>
        <p><TextoConCodigo texto={consulta.descripcion} /></p>
        <div className="etiquetas">
          {consulta.coleccion && <Insignia tono="info">colección {consulta.coleccion}</Insignia>}
          {consulta.demuestra?.map((d) => (
            <Insignia key={d}>{d}</Insignia>
          ))}
        </div>
      </header>

      {consulta.parametros.length > 0 && (
        <form
          className="parametros"
          onSubmit={(e) => {
            e.preventDefault();
            if (faltan.length === 0) void correr(valores);
          }}
        >
          {consulta.parametros.map((p) => (
            <Campo key={p.nombre} def={p} valor={valores[p.nombre] ?? ''} lista={opciones[p.nombre]} alCambiar={(v, auto) => cambiar(p.nombre, v, auto)} />
          ))}
          <button className="btn" type="submit" disabled={faltan.length > 0 || cargando}>
            {cargando ? 'Ejecutando…' : 'Ejecutar'}
          </button>
        </form>
      )}

      {cargando && <Spinner texto="Ejecutando la consulta…" />}
      {error && !cargando && <ErrorAlert error={error} alReintentar={faltan.length === 0 ? () => void correr(valores) : undefined} />}

      {resultado && !cargando && (
        <div className="resultado">
          <div className="resultado-barra">
            <span>
              {num(resultado.total_filas)} {resultado.total_filas === 1 ? 'fila' : 'filas'} · {duracion(resultado.duracion_ms)}
            </span>
            {opcion && (
              <Pestanias
                opciones={[
                  { id: 'grafica', texto: 'Gráfica' },
                  { id: 'tabla', texto: 'Tabla' },
                ]}
                activa={vista}
                alCambiar={setVista}
              />
            )}
          </div>

          {resultado.consulta.grafica === 'detalle' ? (
            <DetalleAspirante fila={resultado.filas[0]} />
          ) : opcion && vista === 'grafica' ? (
            <EChart opcion={opcion} alto={Math.max(340, Math.min(640, 70 + (resultado.filas.length > 14 ? resultado.filas.length * 22 : 300)))} />
          ) : (
            <TablaDatos filas={resultado.filas} />
          )}

          <details className="explicacion" open>
            <summary>Cómo funciona</summary>
            <p><TextoConCodigo texto={consulta.explicacion} /></p>
          </details>
          {codigo && <Codigo titulo={resultado.pipeline ? 'Ver pipeline de MongoDB' : 'Ver consulta Cypher'} codigo={codigo} />}
        </div>
      )}
    </div>
  );
}

function Campo({ def, valor, lista, alCambiar }: { def: ParametroDef; valor: string; lista?: (string | number)[]; alCambiar: (v: string, automatico: boolean) => void }) {
  const id = `p-${def.nombre}`;
  const opcionesSelect = def.tipo === 'opcion' ? def.opciones : lista?.map(String);
  return (
    <label className="campo" htmlFor={id} title={def.descripcion}>
      <span>
        {etiqueta(def.nombre)}
        {def.requerido ? ' *' : ''}
      </span>
      {opcionesSelect ? (
        <select id={id} className="entrada" value={valor} onChange={(e) => alCambiar(e.target.value, true)}>
          {!def.requerido && def.por_defecto === undefined && <option value="">Todos</option>}
          {opcionesSelect.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className="entrada"
          type={def.tipo === 'entero' ? 'number' : 'text'}
          min={def.min}
          max={def.max}
          value={valor}
          placeholder={def.descripcion}
          onChange={(e) => alCambiar(e.target.value, false)}
        />
      )}
    </label>
  );
}
