import { Link } from 'react-router-dom';
import { Fila } from '../types/api';
import { TablaDatos } from './ui/basicos';

/** Ficha completa de un aspirante (resultado de la consulta 15). */
export function DetalleAspirante({ fila }: { fila?: Fila }) {
  if (!fila) return <p className="vacio">Sin datos.</p>;
  const postulaciones = (fila.postulaciones as Fila[]) ?? [];
  const historial = (fila.historial as Fila[]) ?? [];
  const hab = fila.habilitacion as { anio: number; fecha: string } | null;
  return (
    <div className="detalle">
      <dl className="ficha">
        <div>
          <dt>Identificador</dt>
          <dd className="mono">{String(fila._id)}</dd>
        </div>
        <div>
          <dt>Sexo</dt>
          <dd>{String(fila.sexo ?? '—')}</dd>
        </div>
        <div>
          <dt>Año de nacimiento</dt>
          <dd>{String(fila.anio_nacimiento ?? '—')}</dd>
        </div>
        <div>
          <dt>Institución</dt>
          <dd>{String(fila.tipo_institucion ?? '—')}</dd>
        </div>
        <div>
          <dt>Procedencia</dt>
          <dd>{fila.municipio ? `${String(fila.municipio)}, ${String(fila.departamento)}` : '—'}</dd>
        </div>
        <div>
          <dt>Habilitación</dt>
          <dd>{hab ? `Año de ingreso ${hab.anio} (${hab.fecha.slice(0, 10)})` : 'Nunca se habilitó'}</dd>
        </div>
      </dl>
      <h3>Postulaciones</h3>
      <TablaDatos
        filas={postulaciones.map((p) => ({
          anio_ingreso: p.anio_ingreso,
          edad: p.edad,
          carreras: p.carreras,
          estado: String(p.estado).replace(/_/g, ' ').toLowerCase(),
          evaluaciones: p.n_evaluaciones,
          primer_intento_reprobado: (p.primer_intento as Fila | undefined)?.reprobo,
        }))}
      />
      <h3>Historial de evaluaciones</h3>
      <TablaDatos filas={historial} />
      <p>
        <Link className="btn btn-secundario" to={`/grafos?aspirante=${String(fila._id)}`}>
          Ver la red de este aspirante en el grafo
        </Link>
      </p>
    </div>
  );
}
