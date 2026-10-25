import { ConsultaCypher } from '../graph.types';
import { consulta as g01 } from './g01-carreras-demandadas-desde-departamento';
import { consulta as g02 } from './g02-carreras-que-comparten-aspirantes';
import { consulta as g03 } from './g03-cambios-de-carrera-entre-anios';
import { consulta as g04 } from './g04-aprobaron-matematica-tras-varios-intentos';
import { consulta as g05 } from './g05-flujo-de-aprobados-departamento-carrera';
import { consulta as g06 } from './g06-aspirantes-que-reintentan-varios-anios';

/** Registro de las consultas de grafos. Para agregar una nueva basta con importarla aquí. */
export const CONSULTAS_CYPHER: ConsultaCypher[] = [g01, g02, g03, g04, g05, g06];

export function buscarConsultaCypher(id: string): ConsultaCypher | undefined {
  return CONSULTAS_CYPHER.find((c) => c.id === id);
}
