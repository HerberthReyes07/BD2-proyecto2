import { Document } from 'mongodb';
import { AppError } from '../../../shared/errors/AppError';
import { ParametroDef, Parametros } from '../analytics.types';

/** Filtro opcional por año de ingreso, compartido por casi todas las consultas. */
export const PARAM_ANIO: ParametroDef = {
  nombre: 'anio_ingreso',
  tipo: 'entero',
  requerido: false,
  min: 2000,
  max: 2100,
  descripcion: 'Limita la consulta a un año de ingreso',
};

/** Etapa $match por año de ingreso, o ninguna etapa si el filtro no se indicó. */
export const matchAnio = (p: Parametros): Document[] =>
  p.anio_ingreso === undefined ? [] : [{ $match: { anio_ingreso: p.anio_ingreso } }];

/** Porcentaje redondeado a 2 decimales: numerador / denominador * 100. */
export const pct = (numerador: unknown, denominador: unknown): Document => ({
  $round: [{ $multiply: [{ $divide: [numerador, denominador] }, 100] }, 2],
});

/** Convierte el texto de un identificador de aspirante (20 o 32 caracteres) en el aspirante_id de 20. */
export function idAspiranteDesdeParametro(p: Parametros): string {
  const id = String(p.aspirante_id ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{20,32}$/.test(id)) {
    throw new AppError(400, 'PARAMETRO_INVALIDO', 'aspirante_id debe tener entre 20 y 32 caracteres hexadecimales.');
  }
  return id.slice(0, 20);
}

/** Valida y convierte los parámetros recibidos en la URL según su definición. */
export function leerParametros(defs: ParametroDef[], entrada: Record<string, unknown>): Parametros {
  const resultado: Parametros = {};
  for (const def of defs) {
    const bruto = entrada[def.nombre];
    const vacio = bruto === undefined || bruto === null || String(bruto).trim() === '';
    if (vacio) {
      if (def.requerido) throw new AppError(400, 'PARAMETRO_REQUERIDO', `Falta el parámetro "${def.nombre}".`);
      if (def.por_defecto !== undefined) resultado[def.nombre] = def.por_defecto;
      continue;
    }
    const texto = String(bruto).trim();
    if (def.tipo === 'entero') {
      const n = Number(texto);
      if (!Number.isInteger(n) || (def.min !== undefined && n < def.min) || (def.max !== undefined && n > def.max)) {
        const rango = def.min !== undefined && def.max !== undefined ? ` entre ${def.min} y ${def.max}` : '';
        throw new AppError(400, 'PARAMETRO_INVALIDO', `"${def.nombre}" debe ser un entero${rango}.`);
      }
      resultado[def.nombre] = n;
    } else if (def.tipo === 'opcion') {
      if (!def.opciones?.includes(texto)) {
        throw new AppError(400, 'PARAMETRO_INVALIDO', `"${def.nombre}" debe ser uno de: ${def.opciones?.join(', ')}.`);
      }
      resultado[def.nombre] = texto;
    } else {
      if (texto.length > 100 || (def.patron && !new RegExp(def.patron).test(texto.toLowerCase()))) {
        throw new AppError(400, 'PARAMETRO_INVALIDO', `"${def.nombre}" no tiene un formato válido.`);
      }
      resultado[def.nombre] = texto;
    }
  }
  return resultado;
}
