/**
 * Ejecuta las 20 consultas de MongoDB con sus parámetros por defecto y muestra, para cada una, cuántas filas
 * devuelve, cuánto tarda y las primeras filas. Sirve para comprobar rápidamente que todas funcionan.
 *
 * Uso: npm run consultas
 */
import { cerrarMongo, getDb } from '../src/config/mongo';
import { ejecutarConsulta } from '../src/modules/analytics/analytics.service';
import { CONSULTAS } from '../src/modules/analytics/queries';

async function main() {
  const db = await getDb();
  // Para las consultas 11 y 15 se necesita un aspirante: se toma uno que haya participado en varios años
  const ejemplo = await db.collection('aspirantes').findOne({ 'anios_ingreso.1': { $exists: true } });
  const aspirante_id = String(ejemplo?._id ?? '');

  for (const c of CONSULTAS) {
    const entrada = c.parametros.some((p) => p.nombre === 'aspirante_id') ? { aspirante_id } : {};
    const r = await ejecutarConsulta(c.id, entrada);
    console.log(`\n[${c.id}] ${c.titulo}`);
    console.log(`    ${r.total_filas} filas · ${r.duracion_ms} ms`);
    for (const fila of r.filas.slice(0, 3)) console.log('    ', JSON.stringify(fila).slice(0, 220));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => cerrarMongo());
