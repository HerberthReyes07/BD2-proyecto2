import { Db } from 'mongodb';

/**
 * Crea los índices de MongoDB (ver docs/modelo-mongodb.md §8). createIndex es idempotente:
 * si el índice ya existe no hace nada, por eso se puede llamar en cada arranque.
 */
export async function crearIndicesMongo(db: Db): Promise<void> {
  const evaluaciones = db.collection('evaluaciones');
  await evaluaciones.createIndex({ aspirante_id: 1, anio_ingreso: 1, oportunidad: 1 });
  await evaluaciones.createIndex({ materia: 1, aprobada: 1 });
  await evaluaciones.createIndex({ anio_ingreso: 1, aprobada: 1 });
  await evaluaciones.createIndex({ tipo_institucion: 1, anio_mes: 1, materia: 1 });

  const postulaciones = db.collection('postulaciones');
  await postulaciones.createIndex({ aspirante_id: 1 });
  await postulaciones.createIndex({ anio_ingreso: 1, aprobado: 1 });
  await postulaciones.createIndex({ carreras: 1 });
  await postulaciones.createIndex({ departamento: 1, municipio: 1 });
  await postulaciones.createIndex({ edad: 1 });

  await db.collection('cargas').createIndex({ iniciada_en: -1 });
  await db.collection('rechazados').createIndex({ carga_id: 1, causa: 1 });
}
