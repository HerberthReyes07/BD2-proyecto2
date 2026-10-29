import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buscar, catalogosBusqueda, consultasCypher, ejecutarCypher, mapaDemanda, redAspirante } from '../../api/endpoints';
import { QueryRunner } from '../../components/QueryRunner';
import { Codigo, ErrorAlert, Pestanias, Spinner } from '../../components/ui/basicos';
import { useAsync } from '../../hooks/useAsync';
import { Grafo } from '../../types/api';
import { duracion } from '../../utils/formato';
import { COLORES_NODO, CytoscapeView, Seleccion } from './CytoscapeView';

type Pestania = 'mapa' | 'aspirante' | 'cypher';

export function GraphExplorerPage() {
  const [params, setParams] = useSearchParams();
  const aspiranteInicial = params.get('aspirante') ?? '';
  const [pestania, setPestania] = useState<Pestania>(aspiranteInicial ? 'aspirante' : 'mapa');
  const catalogos = useAsync(catalogosBusqueda, []);

  return (
    <div className="pagina">
      <h1>Explorador de grafos</h1>
      <p className="subtitulo">
        Visualiza las relaciones guardadas en Neo4j. Para no saturar el navegador, siempre se dibuja un subgrafo acotado por filtros.
      </p>
      <Pestanias
        opciones={[
          { id: 'mapa', texto: 'Mapa de demanda' },
          { id: 'aspirante', texto: 'Red de un aspirante' },
          { id: 'cypher', texto: 'Consultas Cypher' },
        ]}
        activa={pestania}
        alCambiar={(p) => {
          setPestania(p);
          if (p !== 'aspirante' && params.has('aspirante')) setParams({}, { replace: true });
        }}
      />
      {pestania === 'mapa' && <MapaDemanda anios={catalogos.datos?.anios ?? []} departamentos={catalogos.datos?.departamentos ?? []} />}
      {pestania === 'aspirante' && <RedAspirante inicial={aspiranteInicial} />}
      {pestania === 'cypher' && <ConsultasCypher anios={catalogos.datos?.anios ?? []} departamentos={catalogos.datos?.departamentos ?? []} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Leyenda({ tipos }: { tipos: string[] }) {
  return (
    <ul className="leyenda">
      {tipos.map((t) => (
        <li key={t}>
          <span className="punto" style={{ background: COLORES_NODO[t] }} />
          {t}
        </li>
      ))}
    </ul>
  );
}

function PanelSeleccion({ seleccion }: { seleccion: Seleccion | null }) {
  if (!seleccion) return <aside className="panel-sel vacio">Haz clic en un nodo o una arista para ver sus datos. Se resaltan sus conexiones.</aside>;
  return (
    <aside className="panel-sel">
      <h3>{seleccion.etiqueta}</h3>
      <p className="nota">
        {seleccion.clase === 'nodo' ? 'Nodo' : 'Relación'} · {seleccion.tipo}
        {seleccion.peso !== undefined && ` · ${seleccion.peso.toLocaleString('es-GT')} postulaciones`}
      </p>
      <dl className="props">
        {Object.entries(seleccion.propiedades).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function MapaDemanda({ anios, departamentos }: { anios: number[]; departamentos: string[] }) {
  const [filtros, setFiltros] = useState({ anio_ingreso: '', departamento: '', solo_aprobados: 'no', limite: '150' });
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const datos = useAsync(() => mapaDemanda(filtros), [filtros]);
  const cambiar = (campo: keyof typeof filtros, valor: string) => {
    setSeleccion(null);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  };
  const g = datos.datos?.grafo;

  return (
    <div>
      <p className="nota">
        Cada punto azul claro es un municipio; los departamentos (azul oscuro) agrupan sus municipios y las carreras (naranja) se conectan a
        los municipios de donde vienen sus aspirantes. Cuanto más gruesa la línea, más postulaciones.
      </p>
      <div className="parametros">
        <label className="campo">
          <span>Año de ingreso</span>
          <select className="entrada" value={filtros.anio_ingreso} onChange={(e) => cambiar('anio_ingreso', e.target.value)}>
            <option value="">Todos</option>
            {anios.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Departamento</span>
          <select className="entrada" value={filtros.departamento} onChange={(e) => cambiar('departamento', e.target.value)}>
            <option value="">Todos</option>
            {departamentos.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Aspirantes</span>
          <select className="entrada" value={filtros.solo_aprobados} onChange={(e) => cambiar('solo_aprobados', e.target.value)}>
            <option value="no">Todos</option>
            <option value="si">Solo aprobados</option>
          </select>
        </label>
        <label className="campo">
          <span>Máx. conexiones</span>
          <select className="entrada" value={filtros.limite} onChange={(e) => cambiar('limite', e.target.value)}>
            {['50', '100', '150', '300', '600'].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {datos.cargando && <Spinner texto="Consultando Neo4j…" />}
      {datos.error && <ErrorAlert error={datos.error} alReintentar={datos.recargar} />}
      {g && !datos.cargando && (
        <>
          <div className="resultado-barra">
            <span>
              {g.nodos.length} nodos · {g.aristas.length} aristas · {duracion(datos.datos!.duracion_ms)}
            </span>
            <Leyenda tipos={['Departamento', 'Municipio', 'Carrera']} />
          </div>
          {g.nodos.length === 0 ? (
            <p className="vacio">No hay postulaciones con esos filtros.</p>
          ) : (
            <div className="grafo-layout">
              <CytoscapeView grafo={g} modo="mapa" alSeleccionar={setSeleccion} />
              <PanelSeleccion seleccion={seleccion} />
            </div>
          )}
          <Codigo titulo="Ver consulta Cypher" codigo={datos.datos!.cypher} />
        </>
      )}
    </div>
  );
}

function RedAspirante({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [id, setId] = useState(inicial);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [grafo, setGrafo] = useState<{ aspirante_id: string; grafo: Grafo; duracion_ms: number; cypher: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cargar = async (valor: string) => {
    setCargando(true);
    setError(null);
    setSeleccion(null);
    try {
      setGrafo(await redAspirante(valor));
    } catch (e) {
      setGrafo(null);
      setError(e as Error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (inicial) void cargar(inicial);
  }, [inicial]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setId(texto.trim());
    void cargar(texto.trim());
  };

  const usarEjemplo = async () => {
    try {
      const r = await buscar({ estado: 'APROBADO', por_pagina: 1, pagina: 7 });
      const ejemplo = r.filas[0]?.aspirante_id;
      if (ejemplo) {
        setTexto(ejemplo);
        setId(ejemplo);
        void cargar(ejemplo);
      }
    } catch (e) {
      setError(e as Error);
    }
  };

  return (
    <div>
      <form className="parametros" onSubmit={enviar}>
        <label className="campo campo-ancho">
          <span>Identificador del aspirante</span>
          <input className="entrada mono" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="20 a 32 caracteres hexadecimales" />
        </label>
        <button className="btn" type="submit" disabled={!texto.trim() || cargando}>
          Ver red
        </button>
        <button className="btn btn-secundario" type="button" onClick={() => void usarEjemplo()} disabled={cargando}>
          Usar un ejemplo
        </button>
      </form>
      {!id && !error && <p className="nota">Escribe el identificador de un aspirante (puedes buscarlo en el Buscador) o usa un ejemplo.</p>}

      {cargando && <Spinner texto="Consultando Neo4j…" />}
      {error && <ErrorAlert error={error} />}
      {grafo && !cargando && (
        <>
          <div className="resultado-barra">
            <span>
              {grafo.grafo.nodos.length} nodos · {grafo.grafo.aristas.length} aristas · {duracion(grafo.duracion_ms)}
            </span>
            <Leyenda tipos={['Aspirante', 'Postulacion', 'Carrera', 'Municipio', 'TipoInstitucion', 'Materia']} />
          </div>
          <p className="nota">Las aristas verdes y rojas son las evaluaciones: «Op.2 ✓» es una evaluación aprobada en la oportunidad 2.</p>
          <div className="grafo-layout">
            <CytoscapeView grafo={grafo.grafo} modo="aspirante" alSeleccionar={setSeleccion} />
            <PanelSeleccion seleccion={seleccion} />
          </div>
          <Codigo titulo="Ver consulta Cypher" codigo={grafo.cypher} />
        </>
      )}
    </div>
  );
}

function ConsultasCypher({ anios, departamentos }: { anios: number[]; departamentos: string[] }) {
  const consultas = useAsync(consultasCypher, []);
  if (consultas.cargando) return <Spinner />;
  if (consultas.error) return <ErrorAlert error={consultas.error} alReintentar={consultas.recargar} />;
  return (
    <QueryRunner
      consultas={consultas.datos ?? []}
      ejecutar={ejecutarCypher}
      prefijo="Consulta Cypher"
      opciones={{ anio_ingreso: anios, departamento: departamentos }}
    />
  );
}
