import catalogoMunicipios from '../catalogos/municipios.json';
import { Advertencia, EvaluacionDoc, FilaValidada } from '../etl.types';
import { normalizarTexto } from './texto';

export { normalizarTexto };

export const MECANICA_SIN_PRECISAR = 'INGENIERIA MECANICA (INDUSTRIAL O ELECTRICA, SIN PRECISAR)';
const CIENCIAS_Y_SISTEMAS = 'INGENIERIA EN CIENCIAS Y SISTEMAS';

export type Catalogo = Record<string, string[]>;

/** Los primeros 20 caracteres del correlativo, en minúscula (R-ID1). */
export function idAspirante(correlativo: string): string {
  return correlativo.trim().toLowerCase().slice(0, 20);
}

/**
 * R-C1 a R-C5. IMPORTANTE (R-C4): se evalúa el valor CRUDO antes de recortar espacios. En 2022-2024 la
 * carrera truncada "INGENIERIA MECANICA " (con espacio final) no es lo mismo que "INGENIERIA MECANICA";
 * si se recortara primero, las dos se confundirían.
 */
export function transformarCarrera(cruda: string): { carrera: string | null; advertencias: Advertencia[] } {
  const mayusculas = cruda.toUpperCase();
  if (normalizarTexto(cruda) === 'NINGUNO') return { carrera: null, advertencias: ['SIN_CARRERA'] };
  if (mayusculas === 'INGENIERIA EN CIENCIAS Y ') return { carrera: CIENCIAS_Y_SISTEMAS, advertencias: ['CARRERA_COMPLETADA'] };
  if (mayusculas === 'INGENIERIA MECANICA ') return { carrera: MECANICA_SIN_PRECISAR, advertencias: ['CARRERA_AMBIGUA'] };
  return { carrera: normalizarTexto(cruda), advertencias: [] };
}

/**
 * R-G1 a R-G6: departamento, municipio, zona y tipo de institución.
 * - "SIN DATOS" pasa a null.
 * - "GUATEMALA - CIUDAD CAPITAL ZONA N" se separa en municipio GUATEMALA y zona N (R-G4); si viene truncado
 *   ("GUATEMALA - CIUDAD "), la zona se pierde (R-G4b).
 * - Un municipio truncado (19 caracteres o con espacio final) se completa con el catálogo si hay un único
 *   candidato en ese departamento (R-G5).
 */
export function transformarUbicacion(
  departamentoCrudo: string,
  municipioCrudo: string,
  tipoCrudo: string,
  catalogo: Catalogo = catalogoMunicipios as Catalogo,
): {
  departamento: string | null;
  municipio: string | null;
  zona: number | null;
  tipo_institucion: string | null;
  advertencias: Advertencia[];
} {
  const advertencias: Advertencia[] = [];
  const dep = normalizarTexto(departamentoCrudo);
  const mun = normalizarTexto(municipioCrudo);
  const tipo = normalizarTexto(tipoCrudo);

  const departamento = dep === 'SIN DATOS' ? null : dep;
  const tipo_institucion = tipo === 'SIN DATOS' ? null : tipo;
  let municipio: string | null = null;
  let zona: number | null = null;

  if (mun === 'SIN DATOS') {
    municipio = null;
  } else if (municipioCrudo.toUpperCase().startsWith('GUATEMALA - CIUDAD')) {
    municipio = 'GUATEMALA';
    const m = /^GUATEMALA - CIUDAD CAPITAL ZONA (\d+)$/.exec(mun);
    if (m) zona = Number(m[1]);
    else advertencias.push('ZONA_NO_DISPONIBLE');
  } else if (departamento !== null && (municipioCrudo.length === 19 || municipioCrudo !== municipioCrudo.trimEnd())) {
    // Posible municipio truncado (R-G5)
    const completos = catalogo[departamento] ?? [];
    if (completos.includes(mun)) {
      municipio = mun; // ya estaba completo (por ejemplo SAN PEDRO LA LAGUNA mide justo 19 caracteres)
    } else {
      const candidatos = completos.filter((c) => c.startsWith(mun));
      if (candidatos.length === 1) {
        municipio = candidatos[0];
        advertencias.push('MUNICIPIO_RECUPERADO');
      } else {
        municipio = mun;
        advertencias.push('MUNICIPIO_TRUNCADO');
      }
    }
  } else {
    municipio = mun;
  }

  if (departamento === null || municipio === null || tipo_institucion === null) advertencias.push('INSTITUCION_SIN_DATOS');
  return { departamento, municipio, zona, tipo_institucion, advertencias };
}

/** R-ED1 a R-ED3: edad = año de ingreso − año de nacimiento; válida entre 13 y 70. */
export function calcularEdad(anioIngreso: number, anioNacimiento: number | null): { edad: number | null; advertencias: Advertencia[] } {
  if (anioNacimiento === null) return { edad: null, advertencias: ['SIN_ANIO_NACIMIENTO'] };
  const edad = anioIngreso - anioNacimiento;
  if (edad < 13 || edad > 70) return { edad: null, advertencias: ['EDAD_FUERA_DE_RANGO'] };
  return { edad, advertencias: [] };
}

/** Convierte una fila validada en el documento de la colección `evaluaciones`. */
export function transformarFila(
  fila: FilaValidada,
  contexto: { archivo: string; linea: number; anioArchivo: number | null },
  catalogo?: Catalogo,
): EvaluacionDoc {
  const advertencias: Advertencia[] = [];

  const aspirante_id = idAspirante(fila.correlativo);
  const { carrera, advertencias: advCarrera } = transformarCarrera(fila.carreraCruda);
  const ubic = transformarUbicacion(fila.departamentoCrudo, fila.municipioCrudo, fila.tipoCrudo, catalogo);
  const { edad, advertencias: advEdad } = calcularEdad(fila.anioIngreso, fila.anioNacimiento);

  if (fila.sexo === null) advertencias.push('SEXO_SIN_REGISTRO');
  advertencias.push(...advEdad, ...advCarrera, ...ubic.advertencias);
  if (contexto.anioArchivo !== null && contexto.anioArchivo !== fila.anioIngreso) {
    advertencias.push('ANIO_INGRESO_DISTINTO_DE_ARCHIVO');
  }

  const mes = fila.fecha.getUTCMonth() + 1;
  return {
    _id: `${fila.anioIngreso}|${aspirante_id}|${fila.oportunidad}|${fila.materia}`,
    aspirante_id,
    correlativo_original: fila.correlativo,
    anio_ingreso: fila.anioIngreso,
    oportunidad: fila.oportunidad,
    materia: fila.materia,
    fecha_asignacion: fila.fecha,
    anio_mes: `${fila.fecha.getUTCFullYear()}-${String(mes).padStart(2, '0')}`,
    mes,
    aprobada: fila.aprobada,
    carrera,
    sexo: fila.sexo,
    anio_nacimiento: fila.anioNacimiento,
    edad,
    departamento: ubic.departamento,
    municipio: ubic.municipio,
    zona: ubic.zona,
    tipo_institucion: ubic.tipo_institucion,
    advertencias,
    origen: { archivo: contexto.archivo, linea: contexto.linea },
  };
}
