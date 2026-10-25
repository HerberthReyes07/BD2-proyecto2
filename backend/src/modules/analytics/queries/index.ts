import { ConsultaMongo } from '../analytics.types';
import { consulta as q01 } from './q01-aspirantes-por-tipo-institucion';
import { consulta as q02 } from './q02-aprobados-por-materia';
import { consulta as q03 } from './q03-aprobados-por-carrera-y-anio';
import { consulta as q04 } from './q04-porcentaje-aprobacion-por-materia';
import { consulta as q05 } from './q05-edad-promedio-por-carrera';
import { consulta as q06 } from './q06-resumen-carrera';
import { consulta as q07 } from './q07-edad-promedio-aprobados-carrera-tipo';
import { consulta as q08 } from './q08-aprobados-por-municipio-y-carrera';
import { consulta as q09 } from './q09-evaluaciones-por-mes-y-materia-publicas';
import { consulta as q10 } from './q10-top-carreras-16-a-18';
import { consulta as q11 } from './q11-historial-desempeno-aspirante';
import { consulta as q12 } from './q12-sexo-y-tipo-institucion';
import { consulta as q13 } from './q13-tasa-aprobacion-por-edad';
import { consulta as q14 } from './q14-promedio-intentos-por-materia';
import { consulta as q15 } from './q15-historial-completo-aspirante';
import { consulta as q16 } from './q16-reprobados-primer-intento-por-carrera';
import { consulta as q17 } from './q17-top-municipios';
import { consulta as q18 } from './q18-tasa-aprobacion-por-tipo-institucion';
import { consulta as q19 } from './q19-carreras-mas-demandadas-por-departamento';
import { consulta as q20 } from './q20-evolucion-aprobacion-por-anio';

/** Registro de las 20 consultas de MongoDB, en orden. Para agregar una nueva basta con importarla aquí. */
export const CONSULTAS: ConsultaMongo[] = [q01, q02, q03, q04, q05, q06, q07, q08, q09, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20];

export function buscarConsulta(id: string): ConsultaMongo | undefined {
  return CONSULTAS.find((c) => c.id === id);
}
