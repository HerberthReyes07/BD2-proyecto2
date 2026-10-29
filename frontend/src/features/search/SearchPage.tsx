import { FormEvent, useState } from 'react';
import { buscar, catalogosBusqueda, ejecutarMongo } from '../../api/endpoints';
import { DetalleAspirante } from '../../components/DetalleAspirante';
import { ErrorAlert, InsigniaEstado, Spinner } from '../../components/ui/basicos';
import { useAsync } from '../../hooks/useAsync';
import { PostulacionResumen } from '../../types/api';
import { num } from '../../utils/formato';

const VACIO = { aspirante_id: '', carrera: '', tipo_institucion: '', materia: '', departamento: '', municipio: '', anio_ingreso: '', estado: '', edad_min: '', edad_max: '' };
type Filtros = typeof VACIO;

export function SearchPage() {
  const catalogos = useAsync(catalogosBusqueda, []);
  const [formulario, setFormulario] = useState<Filtros>(VACIO);
  const [aplicados, setAplicados] = useState<Filtros>(VACIO);
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const resultados = useAsync(() => buscar({ ...aplicados, pagina, por_pagina: 25 }), [aplicados, pagina]);
  const c = catalogos.datos;
  const municipios = c ? c.municipios.filter((m) => !formulario.departamento || m.departamento === formulario.departamento) : [];

  const cambiar = (campo: keyof Filtros, valor: string) =>
    setFormulario((f) => ({ ...f, [campo]: valor, ...(campo === 'departamento' ? { municipio: '' } : {}) }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setAplicados(formulario);
  };
  const limpiar = () => {
    setFormulario(VACIO);
    setAplicados(VACIO);
    setPagina(1);
  };

  const r = resultados.datos;
  return (
    <div className="pagina">
      <h1>Buscador</h1>
      <p className="subtitulo">
        Busca postulaciones (un aspirante en un año de ingreso) combinando los criterios que necesites. Haz clic en un resultado para ver la ficha completa del aspirante.
      </p>

      <form className="filtros tarjeta" onSubmit={enviar}>
        <Entrada etiqueta="Aspirante (inicio del identificador)">
          <input className="entrada mono" value={formulario.aspirante_id} onChange={(e) => cambiar('aspirante_id', e.target.value)} placeholder="por ejemplo 949d24" />
        </Entrada>
        <Selector etiqueta="Carrera objetivo" valor={formulario.carrera} opciones={c?.carreras} alCambiar={(v) => cambiar('carrera', v)} />
        <Selector etiqueta="Tipo de institución" valor={formulario.tipo_institucion} opciones={c?.tipos} alCambiar={(v) => cambiar('tipo_institucion', v)} />
        <Selector etiqueta="Materia" valor={formulario.materia} opciones={c?.materias} alCambiar={(v) => cambiar('materia', v)} />
        <Selector etiqueta="Departamento" valor={formulario.departamento} opciones={c?.departamentos} alCambiar={(v) => cambiar('departamento', v)} />
        <Selector etiqueta="Municipio" valor={formulario.municipio} opciones={[...new Set(municipios.map((m) => m.municipio))]} alCambiar={(v) => cambiar('municipio', v)} />
        <Selector etiqueta="Año de ingreso" valor={formulario.anio_ingreso} opciones={c?.anios.map(String)} alCambiar={(v) => cambiar('anio_ingreso', v)} />
        <Selector etiqueta="Estado de aprobación" valor={formulario.estado} opciones={c?.estados} formato={(e) => e.replace(/_/g, ' ').toLowerCase()} alCambiar={(v) => cambiar('estado', v)} />
        <Entrada etiqueta="Edad mínima">
          <input className="entrada" type="number" min={13} max={70} value={formulario.edad_min} onChange={(e) => cambiar('edad_min', e.target.value)} />
        </Entrada>
        <Entrada etiqueta="Edad máxima">
          <input className="entrada" type="number" min={13} max={70} value={formulario.edad_max} onChange={(e) => cambiar('edad_max', e.target.value)} />
        </Entrada>
        <div className="filtros-acciones">
          <button className="btn" type="submit">
            Buscar
          </button>
          <button className="btn btn-secundario" type="button" onClick={limpiar}>
            Limpiar
          </button>
        </div>
      </form>

      {catalogos.error && <ErrorAlert error={catalogos.error} alReintentar={catalogos.recargar} />}
      {resultados.cargando && <Spinner texto="Buscando…" />}
      {resultados.error && <ErrorAlert error={resultados.error} alReintentar={resultados.recargar} />}

      {r && !resultados.cargando && (
        <>
          <div className="resultado-barra">
            <span>
              {num(r.total)} {r.total === 1 ? 'postulación encontrada' : 'postulaciones encontradas'}
            </span>
          </div>
          {r.filas.length === 0 ? (
            <p className="vacio">No hay postulaciones con esos criterios.</p>
          ) : (
            <div className="tabla-caja">
              <table className="tabla tabla-clic">
                <thead>
                  <tr>
                    <th>Aspirante</th>
                    <th className="num">Año</th>
                    <th className="num">Edad</th>
                    <th>Carrera(s)</th>
                    <th>Procedencia</th>
                    <th>Institución</th>
                    <th>Estado</th>
                    <th className="num">Eval.</th>
                  </tr>
                </thead>
                <tbody>
                  {r.filas.map((p: PostulacionResumen) => (
                    <tr key={p._id} onClick={() => setSeleccionado(p.aspirante_id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSeleccionado(p.aspirante_id)}>
                      <td className="mono">{p.aspirante_id}</td>
                      <td className="num">{p.anio_ingreso}</td>
                      <td className="num">{p.edad ?? '—'}</td>
                      <td>{p.carreras.length ? p.carreras.join(', ') : '—'}</td>
                      <td>{p.municipio ? `${p.municipio}, ${p.departamento}${p.zona ? ` z.${p.zona}` : ''}` : '—'}</td>
                      <td>{p.tipo_institucion ?? '—'}</td>
                      <td>
                        <InsigniaEstado estado={p.estado} />
                      </td>
                      <td className="num">{p.n_evaluaciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <footer className="paginacion">
            <button className="btn btn-secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </button>
            <span>
              Página {r.pagina} de {num(r.total_paginas)}
            </span>
            <button className="btn btn-secundario" disabled={pagina >= r.total_paginas} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </button>
          </footer>
        </>
      )}

      {seleccionado && <FichaAspirante id={seleccionado} alCerrar={() => setSeleccionado(null)} />}
    </div>
  );
}

function Entrada({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
    </label>
  );
}

function Selector({ etiqueta, valor, opciones = [], alCambiar, formato }: { etiqueta: string; valor: string; opciones?: string[]; alCambiar: (v: string) => void; formato?: (v: string) => string }) {
  return (
    <Entrada etiqueta={etiqueta}>
      <select className="entrada" value={valor} onChange={(e) => alCambiar(e.target.value)}>
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {formato ? formato(o) : o}
          </option>
        ))}
      </select>
    </Entrada>
  );
}

function FichaAspirante({ id, alCerrar }: { id: string; alCerrar: () => void }) {
  const ficha = useAsync(() => ejecutarMongo('q15', { aspirante_id: id }), [id]);
  return (
    <div className="modal-fondo" onClick={alCerrar}>
      <div className="modal modal-ancho" role="dialog" aria-modal="true" aria-label="Ficha del aspirante" onClick={(e) => e.stopPropagation()}>
        <header className="modal-cabecera">
          <h2>Ficha del aspirante</h2>
          <button className="btn-texto" onClick={alCerrar}>
            Cerrar
          </button>
        </header>
        {ficha.cargando && <Spinner />}
        {ficha.error && <ErrorAlert error={ficha.error} alReintentar={ficha.recargar} />}
        {ficha.datos && <DetalleAspirante fila={ficha.datos.filas[0]} />}
      </div>
    </div>
  );
}
