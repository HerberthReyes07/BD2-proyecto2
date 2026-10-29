import { Link } from 'react-router-dom';
import { catalogosBusqueda, consultasMongo, ejecutarMongo, resumenGeneral } from '../../api/endpoints';
import { QueryRunner } from '../../components/QueryRunner';
import { ErrorAlert, Spinner, Tarjeta } from '../../components/ui/basicos';
import { useAsync } from '../../hooks/useAsync';
import { num } from '../../utils/formato';

export function DashboardPage() {
  const resumen = useAsync(resumenGeneral, []);
  const consultas = useAsync(consultasMongo, []);
  const catalogos = useAsync(catalogosBusqueda, []);

  const r = resumen.datos;
  return (
    <div className="pagina">
      <h1>Dashboard de estadísticas</h1>
      <p className="subtitulo">
        Las 20 consultas analíticas sobre MongoDB. Elige una consulta de la lista; casi todas se pueden filtrar por año de ingreso.
      </p>

      {resumen.error && <ErrorAlert error={resumen.error} alReintentar={resumen.recargar} />}
      {r && r.evaluaciones === 0 && (
        <div className="alerta alerta-aviso">
          No hay datos cargados todavía. Ve a <Link to="/carga">Carga de archivos</Link> y sube los CSV.
        </div>
      )}
      {r && r.evaluaciones > 0 && (
        <div className="kpis">
          <Tarjeta titulo="Evaluaciones" valor={num(r.evaluaciones)} nota={`${r.anio_inicial}–${r.anio_final}`} />
          <Tarjeta titulo="Aspirantes (personas)" valor={num(r.aspirantes)} />
          <Tarjeta titulo="Postulaciones" valor={num(r.postulaciones)} nota="aspirante + año de ingreso" />
          <Tarjeta titulo="Aprobados" valor={num(r.aprobados)} nota={`${((r.aprobados / r.postulaciones) * 100).toFixed(1)} % de las postulaciones`} />
          <Tarjeta titulo="Aprobados en el año" valor={num(r.aprobados_en_el_anio)} nota="ambas materias dentro del año" />
          <Tarjeta titulo="Filas rechazadas" valor={num(r.rechazados)} nota="duplicados detectados al cargar" />
        </div>
      )}

      {(consultas.cargando || catalogos.cargando) && <Spinner />}
      {consultas.error && <ErrorAlert error={consultas.error} alReintentar={consultas.recargar} />}
      {consultas.datos && (
        <QueryRunner
          consultas={consultas.datos}
          ejecutar={ejecutarMongo}
          prefijo="Consulta"
          opciones={{ anio_ingreso: catalogos.datos?.anios ?? [] }}
        />
      )}
    </div>
  );
}
