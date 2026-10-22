import {
  Advertencia,
  AspiranteDoc,
  EstadoPostulacion,
  EvaluacionDoc,
  Materia,
  MateriaResumen,
  PostulacionDoc,
} from '../etl.types';

/**
 * Lógica de aprobación (docs/reglas-etl.md §10 y §11). Son funciones PURAS: reciben las evaluaciones de UN
 * aspirante y devuelven sus documentos derivados. No tocan la base de datos, por eso son fáciles de probar.
 */

const REQUERIDAS: Materia[] = ['MATEMATICA', 'COMPUTACION'];

export interface Habilitacion {
  fecha: Date;
  anio: number;
}

/** R-V1: la aprobación vence 2 años calendario después (el 29 de febrero pasa al 28). */
export function sumarDosAnios(fecha: Date): Date {
  const r = new Date(Date.UTC(fecha.getUTCFullYear() + 2, fecha.getUTCMonth(), fecha.getUTCDate()));
  if (r.getUTCMonth() !== fecha.getUTCMonth()) r.setUTCDate(0);
  return r;
}

function ordenar(evs: EvaluacionDoc[]): EvaluacionDoc[] {
  return [...evs].sort(
    (a, b) =>
      a.anio_ingreso - b.anio_ingreso ||
      a.oportunidad - b.oportunidad ||
      a.fecha_asignacion.getTime() - b.fecha_asignacion.getTime() ||
      a.materia.localeCompare(b.materia),
  );
}

const distintos = <T>(valores: (T | null)[]): T[] => [...new Set(valores.filter((v): v is T => v !== null))].sort();

/**
 * R-V1 a R-V3 / §10.3: un aspirante está HABILITADO cuando tiene una aprobación de Matemática y una de
 * Computación (en cualquier año) tales que la más reciente se obtuvo dentro de los 2 años posteriores a
 * la más antigua. Si hay varios pares válidos se toma la habilitación más temprana.
 */
export function calcularHabilitacion(evs: EvaluacionDoc[]): Habilitacion | null {
  const aprobM = evs.filter((e) => e.aprobada && e.materia === 'MATEMATICA');
  const aprobC = evs.filter((e) => e.aprobada && e.materia === 'COMPUTACION');
  let mejor: Habilitacion | null = null;
  for (const m of aprobM) {
    for (const c of aprobC) {
      const [reciente, antigua] = m.fecha_asignacion.getTime() >= c.fecha_asignacion.getTime() ? [m, c] : [c, m];
      if (reciente.fecha_asignacion.getTime() <= sumarDosAnios(antigua.fecha_asignacion).getTime()) {
        const candidata = { fecha: reciente.fecha_asignacion, anio: reciente.anio_ingreso };
        if (
          mejor === null ||
          candidata.fecha.getTime() < mejor.fecha.getTime() ||
          (candidata.fecha.getTime() === mejor.fecha.getTime() && candidata.anio < mejor.anio)
        ) {
          mejor = candidata;
        }
      }
    }
  }
  return mejor;
}

function primero<K extends keyof EvaluacionDoc>(evs: EvaluacionDoc[], campo: K): EvaluacionDoc[K] | null {
  const v = evs.map((e) => e[campo]).find((x) => x !== null && x !== undefined);
  return v === undefined ? null : v;
}

/** Nivel 2 (§10.1): una fila por materia presentada en el año. */
function resumirMaterias(evsAnio: EvaluacionDoc[]): MateriaResumen[] {
  const porMateria = new Map<Materia, EvaluacionDoc[]>();
  for (const e of evsAnio) porMateria.set(e.materia, [...(porMateria.get(e.materia) ?? []), e]);
  return [...porMateria.keys()].sort().map((materia) => {
    const filas = porMateria
      .get(materia)!
      .sort((a, b) => a.oportunidad - b.oportunidad || a.fecha_asignacion.getTime() - b.fecha_asignacion.getTime());
    const idx = filas.findIndex((f) => f.aprobada);
    return {
      materia,
      aprobada: idx >= 0,
      intentos: filas.length,
      intento_aprobacion: idx >= 0 ? idx + 1 : null, // posición del intento, no el número de oportunidad
      fecha_primera_aprobacion: idx >= 0 ? filas[idx].fecha_asignacion : null,
      oportunidades: filas.map((f) => f.oportunidad),
    };
  });
}

/** R-P1/R-P2: el primer intento son las evaluaciones de la menor oportunidad del año. */
function resumirPrimerIntento(evsAnio: EvaluacionDoc[]): PostulacionDoc['primer_intento'] {
  const minOportunidad = Math.min(...evsAnio.map((e) => e.oportunidad));
  const filas = evsAnio.filter((e) => e.oportunidad === minOportunidad);
  return {
    oportunidad: minOportunidad,
    fecha: new Date(Math.min(...filas.map((f) => f.fecha_asignacion.getTime()))),
    reprobo: filas.some((f) => !f.aprobada),
    carreras: distintos(filas.map((f) => f.carrera)),
    resultados: [...filas]
      .sort((a, b) => a.materia.localeCompare(b.materia))
      .map((f) => ({ materia: f.materia, aprobada: f.aprobada })),
  };
}

/**
 * Banderas R-D3 y R-D4: después de la primera aprobación de una materia, una evaluación NO APROBADA marca
 * REPROBACION_POSTERIOR_A_APROBACION y otra APROBADA marca MULTIPLE_APROBACION. La bandera queda en la
 * postulación (año de ingreso) de la evaluación posterior. La aprobación nunca se revierte.
 */
function banderasPorAnio(evsOrdenadas: EvaluacionDoc[]): Map<number, Set<Advertencia>> {
  const banderas = new Map<number, Set<Advertencia>>();
  const materias = new Set(evsOrdenadas.map((e) => e.materia));
  for (const materia of materias) {
    const filas = evsOrdenadas.filter((e) => e.materia === materia);
    const primera = filas.findIndex((f) => f.aprobada);
    if (primera < 0) continue;
    for (const posterior of filas.slice(primera + 1)) {
      const set = banderas.get(posterior.anio_ingreso) ?? new Set<Advertencia>();
      set.add(posterior.aprobada ? 'MULTIPLE_APROBACION' : 'REPROBACION_POSTERIOR_A_APROBACION');
      banderas.set(posterior.anio_ingreso, set);
    }
  }
  return banderas;
}

export interface ResultadoPersona {
  aspirante: AspiranteDoc;
  postulaciones: PostulacionDoc[];
}

/** Calcula el documento de la persona y los de todas sus postulaciones a partir de sus evaluaciones. */
export function derivarPersona(evaluaciones: EvaluacionDoc[]): ResultadoPersona {
  const evs = ordenar(evaluaciones);
  const id = evs[0].aspirante_id;
  const hab = calcularHabilitacion(evs);
  const banderas = banderasPorAnio(evs);

  const anios = [...new Set(evs.map((e) => e.anio_ingreso))].sort((a, b) => a - b);
  const postulaciones: PostulacionDoc[] = anios.map((anio) => {
    const evsAnio = evs.filter((e) => e.anio_ingreso === anio);

    let estado: EstadoPostulacion;
    if (hab && hab.anio === anio) estado = 'APROBADO';
    else if (hab && hab.anio < anio) estado = 'YA_HABILITADO';
    else {
      // PARCIAL es informativo: alguna materia requerida aprobada hasta ese año, sin mirar la vigencia
      const alguna = evs.some((e) => e.anio_ingreso <= anio && e.aprobada && REQUERIDAS.includes(e.materia));
      estado = alguna ? 'PARCIAL' : 'NO_APROBADO';
    }

    const advertencias = new Set<Advertencia>([...evsAnio.flatMap((e) => e.advertencias), ...(banderas.get(anio) ?? [])]);

    return {
      _id: `${anio}|${id}`,
      aspirante_id: id,
      anio_ingreso: anio,
      sexo: primero(evsAnio, 'sexo'),
      anio_nacimiento: primero(evsAnio, 'anio_nacimiento'),
      edad: primero(evsAnio, 'edad'),
      departamento: primero(evsAnio, 'departamento'),
      municipio: primero(evsAnio, 'municipio'),
      zona: primero(evsAnio, 'zona'),
      tipo_institucion: primero(evsAnio, 'tipo_institucion'),
      carreras: distintos(evsAnio.map((e) => e.carrera)),
      materias: resumirMaterias(evsAnio),
      primer_intento: resumirPrimerIntento(evsAnio),
      n_evaluaciones: evsAnio.length,
      estado,
      aprobado: estado === 'APROBADO',
      anio_habilitacion: hab?.anio ?? null,
      fecha_habilitacion: hab?.fecha ?? null,
      aprobo_ambas_en_el_anio: REQUERIDAS.every((m) => evsAnio.some((e) => e.materia === m && e.aprobada)),
      advertencias: [...advertencias].sort(),
    };
  });

  // Atributos de la persona: se toma el valor más reciente con dato (R-ID3 y modelo-mongodb §5)
  const recientes = [...postulaciones].reverse();
  const conUbicacion = recientes.find((p) => p.departamento !== null && p.municipio !== null);
  const sexosConocidos = new Set(evs.map((e) => e.sexo).filter((s) => s !== null));
  const advertenciasPersona = new Set<Advertencia>([...banderas.values()].flatMap((s) => [...s]));
  if (sexosConocidos.size > 1) advertenciasPersona.add('CONFLICTO_SEXO');

  const aspirante: AspiranteDoc = {
    _id: id,
    correlativo_original: evs.map((e) => e.correlativo_original).reduce((a, b) => (b.length > a.length ? b : a)),
    sexo: recientes.map((p) => p.sexo).find((s) => s !== null) ?? null,
    anio_nacimiento: recientes.map((p) => p.anio_nacimiento).find((n) => n !== null) ?? null,
    tipo_institucion: recientes.map((p) => p.tipo_institucion).find((t) => t !== null) ?? null,
    departamento: conUbicacion?.departamento ?? null,
    municipio: conUbicacion?.municipio ?? null,
    anios_ingreso: anios,
    habilitacion: hab,
    historial: evs.map((e) => ({
      anio_ingreso: e.anio_ingreso,
      oportunidad: e.oportunidad,
      fecha: e.fecha_asignacion,
      materia: e.materia,
      aprobada: e.aprobada,
      carrera: e.carrera,
    })),
    advertencias: [...advertenciasPersona].sort(),
  };

  return { aspirante, postulaciones };
}
