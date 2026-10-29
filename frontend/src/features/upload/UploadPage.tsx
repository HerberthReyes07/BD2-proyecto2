import { DragEvent, useRef, useState } from 'react';
import { borrarDatos, listarCargas, listarRechazados, resumenGeneral, subirArchivos } from '../../api/endpoints';
import { ErrorAlert, Insignia, InsigniaEstado, Spinner, Tarjeta } from '../../components/ui/basicos';
import { useAsync } from '../../hooks/useAsync';
import { Rechazado, ReporteCarga, ResultadoCargas, ResultadoReinicio } from '../../types/api';
import { duracion, fechaHora, num } from '../../utils/formato';

export function UploadPage() {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [resultado, setResultado] = useState<ResultadoCargas | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const historial = useAsync(listarCargas, []);
  const [verRechazos, setVerRechazos] = useState<ReporteCarga | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrado, setBorrado] = useState<ResultadoReinicio | null>(null);

  const agregar = (lista: FileList | File[]) => {
    const nuevos = [...lista].filter((f) => f.name.toLowerCase().endsWith('.csv'));
    const ignorados = [...lista].length - nuevos.length;
    setError(ignorados > 0 ? new Error(`${ignorados} archivo(s) se ignoraron porque no son .csv.`) : null);
    setArchivos((actuales) => {
      const nombres = new Set(actuales.map((a) => a.name));
      return [...actuales, ...nuevos.filter((n) => !nombres.has(n.name))].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    agregar(e.dataTransfer.files);
  };

  const cargar = async () => {
    setSubiendo(true);
    setError(null);
    setResultado(null);
    setBorrado(null);
    try {
      setResultado(await subirArchivos(archivos));
      setArchivos([]);
      historial.recargar();
    } catch (e) {
      setError(e as Error);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="pagina">
      <h1>Carga de archivos</h1>
      <p className="subtitulo">
        Sube uno o varios CSV de pruebas específicas. El backend los valida, los transforma y los guarda en MongoDB y en Neo4j. Si subes
        un archivo que ya estaba cargado, sus filas se reportan como <em>omitidas</em> y no se duplican.
      </p>

      <div
        className={arrastrando ? 'zona-subida arrastrando' : 'zona-subida'}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
      >
        <p>
          <strong>Arrastra aquí los archivos .csv</strong> o
        </p>
        <button className="btn btn-secundario" onClick={() => entrada.current?.click()} disabled={subiendo}>
          Elegir archivos
        </button>
        <input ref={entrada} type="file" accept=".csv" multiple hidden onChange={(e) => e.target.files && agregar(e.target.files)} />
      </div>

      {archivos.length > 0 && (
        <div className="tarjeta">
          <h3>Archivos seleccionados ({archivos.length})</h3>
          <ul className="lista-archivos">
            {archivos.map((a) => (
              <li key={a.name}>
                <span>{a.name}</span>
                <span className="nota">{(a.size / 1024 / 1024).toFixed(2)} MB</span>
                <button className="btn-texto" onClick={() => setArchivos((x) => x.filter((y) => y !== a))} disabled={subiendo} aria-label={`Quitar ${a.name}`}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={() => void cargar()} disabled={subiendo}>
            {subiendo ? 'Procesando…' : `Cargar ${archivos.length} archivo${archivos.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {subiendo && <Spinner texto="Procesando los archivos y actualizando MongoDB y Neo4j. Con los 10 archivos puede tardar cerca de un minuto…" />}
      {error && <ErrorAlert error={error} />}
      {borrado && (
        <div className="alerta alerta-ok" role="status">
          <strong>Datos borrados.</strong> Se eliminaron {num(borrado.mongo.documentos_borrados)} documentos de MongoDB y{' '}
          {num(borrado.neo4j.nodos_borrados)} nodos de Neo4j en {duracion(borrado.duracion_ms)}. Ya puedes cargar los archivos desde cero.
        </div>
      )}
      {resultado && <ReporteResultado resultado={resultado} alVerRechazos={setVerRechazos} />}

      <h2>Historial de cargas</h2>
      {historial.cargando && <Spinner />}
      {historial.error && <ErrorAlert error={historial.error} alReintentar={historial.recargar} />}
      {historial.datos && <TablaCargas cargas={historial.datos} alVerRechazos={setVerRechazos} />}

      <section className="zona-peligro">
        <h2>Borrar los datos cargados</h2>
        <p>
          Elimina todo lo que hay en MongoDB y en Neo4j, incluido el historial de cargas, para que puedas probar la carga desde cero. Los
          archivos CSV originales no se tocan.
        </p>
        <button className="btn btn-peligro" onClick={() => setConfirmandoBorrado(true)} disabled={subiendo}>
          Borrar todos los datos
        </button>
      </section>

      {confirmandoBorrado && (
        <ModalBorrarDatos
          alCancelar={() => setConfirmandoBorrado(false)}
          alBorrar={(r) => {
            setConfirmandoBorrado(false);
            setBorrado(r);
            setResultado(null);
            historial.recargar();
          }}
        />
      )}
      {verRechazos && <ModalRechazados carga={verRechazos} alCerrar={() => setVerRechazos(null)} />}
    </div>
  );
}

function ReporteResultado({ resultado, alVerRechazos }: { resultado: ResultadoCargas; alVerRechazos: (c: ReporteCarga) => void }) {
  const total = resultado.archivos.reduce((t, a) => ({ leidos: t.leidos + a.leidos, cargados: t.cargados + a.cargados, rechazados: t.rechazados + a.rechazados, omitidos: t.omitidos + a.omitidos }), { leidos: 0, cargados: 0, rechazados: 0, omitidos: 0 });
  return (
    <section className="tarjeta">
      <h2>Resultado de la carga</h2>
      <div className="kpis">
        <Tarjeta titulo="Registros leídos" valor={num(total.leidos)} />
        <Tarjeta titulo="Procesados correctamente" valor={num(total.cargados)} />
        <Tarjeta titulo="Rechazados" valor={num(total.rechazados)} />
        <Tarjeta titulo="Omitidos (ya cargados)" valor={num(total.omitidos)} />
      </div>
      <TablaCargas cargas={resultado.archivos} alVerRechazos={alVerRechazos} />
      <div className="resumen-bases">
        <div>
          <strong>MongoDB</strong>
          {resultado.derivadas ? (
            <p>
              {num(resultado.derivadas.aspirantes)} aspirantes y {num(resultado.derivadas.postulaciones)} postulaciones reconstruidos en{' '}
              {duracion(resultado.derivadas.duracion_ms)}.
            </p>
          ) : (
            <p>No hubo datos nuevos: las colecciones derivadas no cambiaron.</p>
          )}
        </div>
        <div>
          <strong>Neo4j</strong> <InsigniaEstado estado={resultado.neo4j.estado} />
          <p>
            {resultado.neo4j.estado === 'OMITIDA'
              ? 'No hubo datos nuevos: el grafo no cambió.'
              : `${num(resultado.neo4j.nodos_creados)} nodos y ${num(resultado.neo4j.relaciones_creadas)} relaciones creados en ${duracion(resultado.neo4j.duracion_ms)}.`}
          </p>
          {resultado.neo4j.error && <p className="texto-error">{resultado.neo4j.error}</p>}
        </div>
      </div>
    </section>
  );
}

function TablaCargas({ cargas, alVerRechazos }: { cargas: ReporteCarga[]; alVerRechazos: (c: ReporteCarga) => void }) {
  if (cargas.length === 0) return <p className="vacio">Todavía no se ha cargado ningún archivo.</p>;
  return (
    <div className="tabla-caja">
      <table className="tabla">
        <thead>
          <tr>
            <th>Archivo</th>
            <th>Estado</th>
            <th className="num">Leídos</th>
            <th className="num">Procesados</th>
            <th className="num">Rechazados</th>
            <th className="num">Omitidos</th>
            <th className="num">Tiempo</th>
            <th>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cargas.map((c) => (
            <tr key={c._id}>
              <td>{c.archivo}</td>
              <td>
                <InsigniaEstado estado={c.estado} />
                {c.error && <div className="texto-error">{c.error}</div>}
              </td>
              <td className="num">{num(c.leidos)}</td>
              <td className="num">{num(c.cargados)}</td>
              <td className="num">{num(c.rechazados)}</td>
              <td className="num">{num(c.omitidos)}</td>
              <td className="num">{duracion(c.duracion_ms)}</td>
              <td>{fechaHora(c.iniciada_en)}</td>
              <td>
                {c.rechazados > 0 && (
                  <button className="btn-texto" onClick={() => alVerRechazos(c)}>
                    Ver rechazados
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const POR_PAGINA = 50;

function ModalRechazados({ carga, alCerrar }: { carga: ReporteCarga; alCerrar: () => void }) {
  const [causa, setCausa] = useState('');
  const [pagina, setPagina] = useState(0);
  const datos = useAsync(() => listarRechazados(carga._id, { causa, limite: POR_PAGINA, salto: pagina * POR_PAGINA }), [carga._id, causa, pagina]);
  const total = datos.datos?.total ?? 0;
  return (
    <div className="modal-fondo" onClick={alCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Filas rechazadas" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <h2>Filas rechazadas · {carga.archivo}</h2>
          <button className="btn-texto" onClick={alCerrar}>
            Cerrar
          </button>
        </header>
        <div className="etiquetas">
          <button className={causa === '' ? 'filtro activo' : 'filtro'} onClick={() => { setCausa(''); setPagina(0); }}>
            Todas ({num(carga.rechazados)})
          </button>
          {Object.entries(carga.rechazos_por_causa).map(([c, n]) => (
            <button key={c} className={causa === c ? 'filtro activo' : 'filtro'} onClick={() => { setCausa(c); setPagina(0); }}>
              {c} ({num(n)})
            </button>
          ))}
        </div>
        {datos.cargando && <Spinner />}
        {datos.error && <ErrorAlert error={datos.error} alReintentar={datos.recargar} />}
        {datos.datos && (
          <div className="tabla-caja">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="num">Línea</th>
                  <th>Causa</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {datos.datos.filas.map((f: Rechazado) => (
                  <tr key={f._id}>
                    <td className="num">{f.linea}</td>
                    <td>
                      <Insignia tono="aviso">{f.causa}</Insignia>
                    </td>
                    <td>{f.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="paginacion">
          <button className="btn btn-secundario" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <span>
            {total === 0 ? 0 : pagina * POR_PAGINA + 1}–{Math.min(total, (pagina + 1) * POR_PAGINA)} de {num(total)}
          </span>
          <button className="btn btn-secundario" disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setPagina((p) => p + 1)}>
            Siguiente
          </button>
        </footer>
      </div>
    </div>
  );
}

function ModalBorrarDatos({ alCancelar, alBorrar }: { alCancelar: () => void; alBorrar: (r: ResultadoReinicio) => void }) {
  const resumen = useAsync(resumenGeneral, []);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const confirmar = async () => {
    setBorrando(true);
    setError(null);
    try {
      alBorrar(await borrarDatos());
    } catch (e) {
      setError(e as Error);
      setBorrando(false);
    }
  };

  const r = resumen.datos;
  return (
    <div className="modal-fondo" onClick={borrando ? undefined : alCancelar}>
      <div className="modal modal-estrecho" role="alertdialog" aria-modal="true" aria-label="Confirmar el borrado de datos" onClick={(e) => e.stopPropagation()}>
        <h2>¿Borrar todos los datos?</h2>
        <p>Esta acción no se puede deshacer. Se eliminará:</p>
        <ul className="lista-borrado">
          <li>
            <strong>MongoDB:</strong>{' '}
            {r ? `${num(r.evaluaciones)} evaluaciones, ${num(r.postulaciones)} postulaciones y ${num(r.aspirantes)} aspirantes` : 'todas las colecciones'}, más el
            historial de cargas y las filas rechazadas.
          </li>
          <li>
            <strong>Neo4j:</strong> todos los nodos y relaciones del grafo.
          </li>
        </ul>
        <p className="nota">Los archivos CSV originales no se tocan: podrás volver a cargarlos.</p>
        {error && <ErrorAlert error={error} />}
        {borrando && <Spinner texto="Borrando datos de MongoDB y Neo4j… puede tardar cerca de un minuto." />}
        <div className="modal-acciones">
          <button className="btn btn-secundario" onClick={alCancelar} disabled={borrando}>
            Cancelar
          </button>
          <button className="btn btn-peligro" onClick={() => void confirmar()} disabled={borrando}>
            Sí, borrar todo
          </button>
        </div>
      </div>
    </div>
  );
}
