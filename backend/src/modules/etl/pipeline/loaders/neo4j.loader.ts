import { Db } from 'mongodb';
import { Session } from 'neo4j-driver';
import { conSesion, entero } from '../../../../config/neo4j';
import { crearRestriccionesNeo4j } from '../../../../db/neo4j.constraints';
import { AspiranteDoc, EvaluacionDoc, PostulacionDoc, ResumenNeo4j } from '../../etl.types';
import { MECANICA_SIN_PRECISAR } from '../transformer';

/**
 * Sincroniza Neo4j con las colecciones derivadas de MongoDB (docs/modelo-neo4j.md §7).
 * Todo usa MERGE sobre claves únicas, así que se puede ejecutar las veces que haga falta sin duplicar nada.
 * Cada lote se envía con UNWIND: una sola consulta por lote en lugar de una por fila.
 */

interface Contadores {
  nodos: number;
  relaciones: number;
}

const LOTE_POSTULACIONES = 2000;
const LOTE_EVALUACIONES = 5000;

async function ejecutar(sesion: Session, cypher: string, params: Record<string, unknown>, total: Contadores): Promise<void> {
  const resultado = await sesion.executeWrite((tx) => tx.run(cypher, params));
  const c = resultado.summary.counters.updates();
  total.nodos += c.nodesCreated;
  total.relaciones += c.relationshipsCreated;
}

export async function sincronizarNeo4j(db: Db): Promise<ResumenNeo4j> {
  const t0 = Date.now();
  const total: Contadores = { nodos: 0, relaciones: 0 };
  try {
    await crearRestriccionesNeo4j();
    await conSesion(async (sesion) => {
      await cargarCatalogos(db, sesion, total);
      await cargarPostulaciones(db, sesion, total);
      await cargarEvaluaciones(db, sesion, total);
    });
    return { estado: 'COMPLETADA', nodos_creados: total.nodos, relaciones_creadas: total.relaciones, duracion_ms: Date.now() - t0 };
  } catch (err) {
    return {
      estado: 'FALLIDA',
      nodos_creados: total.nodos,
      relaciones_creadas: total.relaciones,
      duracion_ms: Date.now() - t0,
      error: (err as Error).message,
    };
  }
}

// Paso 2: catálogos (materias, tipos de institución, carreras, departamentos y municipios)
async function cargarCatalogos(db: Db, sesion: Session, total: Contadores): Promise<void> {
  const materias = (await db.collection('evaluaciones').distinct('materia')) as string[];
  const tipos = ((await db.collection('postulaciones').distinct('tipo_institucion')) as (string | null)[]).filter((t) => t !== null);
  // distinct sobre un arreglo vacío devuelve un valor vacío (postulaciones sin carrera): solo se aceptan textos
  const carreras = ((await db.collection('postulaciones').distinct('carreras')) as unknown[]).filter(
    (c): c is string => typeof c === 'string',
  );
  const lugares = await db
    .collection('postulaciones')
    .aggregate<{ departamento: string; municipio: string }>([
      { $match: { departamento: { $ne: null }, municipio: { $ne: null } } },
      { $group: { _id: { departamento: '$departamento', municipio: '$municipio' } } },
      { $project: { _id: 0, departamento: '$_id.departamento', municipio: '$_id.municipio' } },
    ])
    .toArray();

  await ejecutar(sesion, 'UNWIND $items AS x MERGE (:Materia {nombre: x})', { items: materias }, total);
  await ejecutar(sesion, 'UNWIND $items AS x MERGE (:TipoInstitucion {nombre: x})', { items: tipos }, total);
  await ejecutar(
    sesion,
    'UNWIND $items AS x MERGE (c:Carrera {nombre: x.nombre}) SET c.ambigua = x.ambigua',
    { items: carreras.map((nombre) => ({ nombre, ambigua: nombre === MECANICA_SIN_PRECISAR ? true : null })) },
    total,
  );
  await ejecutar(
    sesion,
    `UNWIND $items AS x
     MERGE (d:Departamento {nombre: x.departamento})
     MERGE (m:Municipio {id: x.id})
     SET m.nombre = x.municipio, m.departamento = x.departamento
     MERGE (m)-[:PERTENECE_A]->(d)`,
    { items: lugares.map((l) => ({ ...l, id: `${l.departamento}|${l.municipio}` })) },
    total,
  );
}

// Paso 3: aspirantes, postulaciones y sus relaciones
async function cargarPostulaciones(db: Db, sesion: Session, total: Contadores): Promise<void> {
  // 3a. Aspirantes
  let lote: { id: string; sexo: string | null; anio_nacimiento: ReturnType<typeof entero> }[] = [];
  const volcarAspirantes = async () => {
    if (lote.length === 0) return;
    await ejecutar(
      sesion,
      'UNWIND $filas AS f MERGE (a:Aspirante {id: f.id}) SET a.sexo = f.sexo, a.anio_nacimiento = f.anio_nacimiento',
      { filas: lote },
      total,
    );
    lote = [];
  };
  const aspirantes = db.collection<AspiranteDoc>('aspirantes').find({}, { projection: { sexo: 1, anio_nacimiento: 1 } });
  for await (const a of aspirantes) {
    lote.push({ id: a._id, sexo: a.sexo, anio_nacimiento: entero(a.anio_nacimiento) });
    if (lote.length >= LOTE_POSTULACIONES) await volcarAspirantes();
  }
  await volcarAspirantes();

  // 3b. Postulaciones: nodo + POSTULO, y luego ASPIRA_A, PROCEDE_DE y EN_INSTITUCION
  let filas: PostulacionDoc[] = [];
  const volcarPostulaciones = async () => {
    if (filas.length === 0) return;
    await ejecutar(
      sesion,
      `UNWIND $filas AS f
       MATCH (a:Aspirante {id: f.aspirante_id})
       MERGE (p:Postulacion {id: f.id})
       SET p.anio_ingreso = f.anio_ingreso, p.edad = f.edad, p.zona = f.zona, p.estado = f.estado,
           p.aprobado = f.aprobado, p.aprobo_ambas_en_el_anio = f.aprobo_ambas_en_el_anio,
           p.anio_habilitacion = f.anio_habilitacion, p.n_evaluaciones = f.n_evaluaciones
       MERGE (a)-[:POSTULO]->(p)`,
      {
        filas: filas.map((p) => ({
          id: p._id,
          aspirante_id: p.aspirante_id,
          anio_ingreso: entero(p.anio_ingreso),
          edad: entero(p.edad),
          zona: entero(p.zona),
          estado: p.estado,
          aprobado: p.aprobado,
          aprobo_ambas_en_el_anio: p.aprobo_ambas_en_el_anio,
          anio_habilitacion: entero(p.anio_habilitacion),
          n_evaluaciones: entero(p.n_evaluaciones),
        })),
      },
      total,
    );
    // Un dato ausente (carrera, municipio o tipo null) no genera relación (modelo-neo4j §5.5)
    const carreras = filas.flatMap((p) => p.carreras.map((carrera) => ({ id: p._id, carrera })));
    if (carreras.length > 0) {
      await ejecutar(
        sesion,
        'UNWIND $filas AS f MATCH (p:Postulacion {id: f.id}) MATCH (c:Carrera {nombre: f.carrera}) MERGE (p)-[:ASPIRA_A]->(c)',
        { filas: carreras },
        total,
      );
    }
    const municipios = filas
      .filter((p) => p.departamento !== null && p.municipio !== null)
      .map((p) => ({ id: p._id, municipio_id: `${p.departamento}|${p.municipio}` }));
    if (municipios.length > 0) {
      await ejecutar(
        sesion,
        'UNWIND $filas AS f MATCH (p:Postulacion {id: f.id}) MATCH (m:Municipio {id: f.municipio_id}) MERGE (p)-[:PROCEDE_DE]->(m)',
        { filas: municipios },
        total,
      );
    }
    const tipos = filas.filter((p) => p.tipo_institucion !== null).map((p) => ({ id: p._id, tipo: p.tipo_institucion }));
    if (tipos.length > 0) {
      await ejecutar(
        sesion,
        'UNWIND $filas AS f MATCH (p:Postulacion {id: f.id}) MATCH (t:TipoInstitucion {nombre: f.tipo}) MERGE (p)-[:EN_INSTITUCION]->(t)',
        { filas: tipos },
        total,
      );
    }
    filas = [];
  };
  for await (const p of db.collection<PostulacionDoc>('postulaciones').find()) {
    filas.push(p);
    if (filas.length >= LOTE_POSTULACIONES) await volcarPostulaciones();
  }
  await volcarPostulaciones();
}

// Paso 4: cada evaluación es una relación EVALUADA_EN con propiedades (modelo-neo4j §5.2)
async function cargarEvaluaciones(db: Db, sesion: Session, total: Contadores): Promise<void> {
  let lote: object[] = [];
  const volcar = async () => {
    if (lote.length === 0) return;
    await ejecutar(
      sesion,
      `UNWIND $filas AS e
       MATCH (p:Postulacion {id: e.postulacion_id})
       MATCH (m:Materia {nombre: e.materia})
       MERGE (p)-[r:EVALUADA_EN {oportunidad: e.oportunidad}]->(m)
       SET r.fecha = date(e.fecha), r.aprobada = e.aprobada, r.intento = e.intento, r.carrera = e.carrera`,
      { filas: lote },
      total,
    );
    lote = [];
  };

  // Las evaluaciones llegan ordenadas por aspirante, año y oportunidad; `intento` es la posición de la
  // evaluación entre las de esa materia en ese año (1, 2, 3...), no el número de oportunidad.
  const contadorIntentos = new Map<string, number>();
  let aspiranteActual = '';
  const cursor = db
    .collection<EvaluacionDoc>('evaluaciones')
    .find()
    .sort({ aspirante_id: 1, anio_ingreso: 1, oportunidad: 1 })
    .batchSize(LOTE_EVALUACIONES);
  for await (const e of cursor) {
    if (e.aspirante_id !== aspiranteActual) {
      contadorIntentos.clear();
      aspiranteActual = e.aspirante_id;
    }
    const clave = `${e.anio_ingreso}|${e.materia}`;
    const intento = (contadorIntentos.get(clave) ?? 0) + 1;
    contadorIntentos.set(clave, intento);
    lote.push({
      postulacion_id: `${e.anio_ingreso}|${e.aspirante_id}`,
      materia: e.materia,
      oportunidad: entero(e.oportunidad),
      fecha: e.fecha_asignacion.toISOString().slice(0, 10),
      aprobada: e.aprobada,
      intento: entero(intento),
      carrera: e.carrera,
    });
    if (lote.length >= LOTE_EVALUACIONES) await volcar();
  }
  await volcar();
}
