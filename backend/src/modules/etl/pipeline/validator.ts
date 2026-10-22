import {
  CAMPOS,
  CausaRechazo,
  FilaValidada,
  MATERIAS,
  Materia,
  TIPOS_INSTITUCION,
  ValoresCrudos,
} from '../etl.types';

export type ResultadoValidacion =
  | { ok: true; fila: FilaValidada }
  | { ok: false; causa: CausaRechazo; detalle: string };

const mayus = (s: string) => s.trim().toUpperCase();

/** Convierte "AAAA-MM-DD" en una fecha UTC, o null si no es una fecha real (por ejemplo 2015-02-30). */
function leerFecha(texto: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto ? null : fecha;
}

/**
 * Valida una fila y convierte los tipos (reglas de la sección 4 de docs/reglas-etl.md).
 * Devuelve la PRIMERA causa de rechazo que encuentre. Carrera y ubicación no se normalizan aquí:
 * pasan crudas al transformador, que necesita ver los espacios finales.
 */
export function validarFila(v: ValoresCrudos): ResultadoValidacion {
  const rechazo = (causa: CausaRechazo, detalle: string): ResultadoValidacion => ({ ok: false, causa, detalle });

  for (const campo of CAMPOS) {
    if (v[campo].trim() === '') return rechazo('CAMPO_REQUERIDO_VACIO', `El campo ${campo} está vacío`);
  }

  const fecha = leerFecha(v.fecha_asignacion.trim());
  if (!fecha) return rechazo('FECHA_INVALIDA', `fecha_asignacion inválida: "${v.fecha_asignacion}"`);

  const sexoTxt = mayus(v.sexo);
  if (!['M', 'F', 'SIN REGISTRO'].includes(sexoTxt)) return rechazo('SEXO_INVALIDO', `sexo inválido: "${v.sexo}"`);

  const nacTxt = mayus(v.anio_nacimiento);
  if (nacTxt !== 'SIN REGISTRO' && !/^\d{4}$/.test(nacTxt)) {
    return rechazo('ANIO_NACIMIENTO_INVALIDO', `anio_nacimiento inválido: "${v.anio_nacimiento}"`);
  }

  const materia = mayus(v.materia);
  if (!(MATERIAS as readonly string[]).includes(materia)) return rechazo('MATERIA_INVALIDA', `materia inválida: "${v.materia}"`);

  const oportunidadTxt = v.numero_de_fecha_de_evaluacion.trim();
  if (!/^\d+$/.test(oportunidadTxt) || Number(oportunidadTxt) < 1) {
    return rechazo('OPORTUNIDAD_INVALIDA', `numero_de_fecha_de_evaluacion inválido: "${v.numero_de_fecha_de_evaluacion}"`);
  }

  const ingresoTxt = v.anio_de_ingreso.trim();
  if (!/^\d{4}$/.test(ingresoTxt)) return rechazo('ANIO_INGRESO_INVALIDO', `anio_de_ingreso inválido: "${v.anio_de_ingreso}"`);

  const aprobacion = mayus(v.aprobacion);
  if (aprobacion !== 'APROBADO' && aprobacion !== 'NO APROBADO') {
    return rechazo('APROBACION_INVALIDA', `aprobacion inválida: "${v.aprobacion}"`);
  }

  const tipo = mayus(v.tipo_institucion_educativa);
  if (tipo !== 'SIN DATOS' && !(TIPOS_INSTITUCION as readonly string[]).includes(tipo)) {
    return rechazo('TIPO_INSTITUCION_INVALIDO', `tipo_institucion_educativa inválido: "${v.tipo_institucion_educativa}"`);
  }

  const correlativo = v.correlativo_aspirante.trim().toLowerCase();
  if (!/^[0-9a-f]{20,32}$/.test(correlativo)) {
    return rechazo('CORRELATIVO_INVALIDO', `correlativo_aspirante inválido: "${v.correlativo_aspirante}"`);
  }

  return {
    ok: true,
    fila: {
      fecha,
      sexo: sexoTxt === 'SIN REGISTRO' ? null : (sexoTxt as 'M' | 'F'),
      anioNacimiento: nacTxt === 'SIN REGISTRO' ? null : Number(nacTxt),
      materia: materia as Materia,
      oportunidad: Number(oportunidadTxt),
      anioIngreso: Number(ingresoTxt),
      aprobada: aprobacion === 'APROBADO',
      carreraCruda: v.carrera_objetivo,
      departamentoCrudo: v.departamento_institucion_educativa,
      municipioCrudo: v.municipio_institucion_educativa,
      tipoCrudo: v.tipo_institucion_educativa,
      correlativo,
    },
  };
}
