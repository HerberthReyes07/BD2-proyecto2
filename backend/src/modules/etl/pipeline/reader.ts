import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import { AppError } from '../../../shared/errors/AppError';
import { CAMPOS, Campo, ValoresCrudos } from '../etl.types';

export type FilaLeida =
  | { tipo: 'fila'; linea: number; valores: ValoresCrudos }
  | { tipo: 'rota'; linea: number; detalle: string; crudo: string[] };

/**
 * R-E1/R-E2: las columnas se identifican por NOMBRE, no por posición. Un encabezado vale si es prefijo
 * (sin distinguir mayúsculas) de exactamente un nombre canónico: los archivos 2022-2024 traen encabezados
 * cortados como "numero_de_fecha_de_evaluaci" o "municipio_institucion_".
 * R-E3: si falta una columna o un encabezado no se reconoce, se lanza un error y el archivo no se carga.
 */
export function mapearEncabezados(encabezados: string[]): Campo[] {
  const resultado: Campo[] = [];
  for (const crudo of encabezados) {
    const h = crudo.trim().toLowerCase();
    const candidatos = h === '' ? [] : CAMPOS.filter((c) => c.startsWith(h));
    if (candidatos.length !== 1) {
      throw new AppError(422, 'ENCABEZADO_NO_RECONOCIDO', `Encabezado no reconocido: "${crudo}"`);
    }
    resultado.push(candidatos[0]);
  }
  const faltantes = CAMPOS.filter((c) => !resultado.includes(c));
  if (faltantes.length > 0) {
    throw new AppError(422, 'COLUMNA_REQUERIDA_AUSENTE', `Faltan columnas requeridas: ${faltantes.join(', ')}`);
  }
  if (new Set(resultado).size !== resultado.length) {
    throw new AppError(422, 'ENCABEZADO_NO_RECONOCIDO', 'Hay columnas repetidas en el encabezado');
  }
  return resultado;
}

/**
 * Lee un CSV en streaming y entrega una fila por vez. No se recortan espacios (trim) a propósito:
 * valores como "INGENIERIA MECANICA " (con espacio final) significan algo distinto de "INGENIERIA MECANICA" (R-C4).
 */
export async function* leerFilas(ruta: string): AsyncGenerator<FilaLeida> {
  const parser = createReadStream(ruta).pipe(
    parse({
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true, // la cantidad de columnas se valida aquí abajo (R-E5), fila por fila
      info: true,
    }),
  );

  let columnas: Campo[] | null = null;
  for await (const item of parser) {
    const { record, info } = item as { record: string[]; info: { lines: number } };
    if (columnas === null) {
      columnas = mapearEncabezados(record);
      continue;
    }
    if (record.length !== columnas.length) {
      yield {
        tipo: 'rota',
        linea: info.lines,
        detalle: `Se esperaban ${columnas.length} columnas y la fila trae ${record.length}`,
        crudo: record,
      };
      continue;
    }
    const valores = {} as ValoresCrudos;
    columnas.forEach((campo, i) => {
      valores[campo] = record[i];
    });
    yield { tipo: 'fila', linea: info.lines, valores };
  }
  if (columnas === null) {
    throw new AppError(422, 'ARCHIVO_VACIO', 'El archivo no tiene encabezado ni filas');
  }
}
