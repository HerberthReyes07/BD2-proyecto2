/**
 * Ejecuta las consultas Cypher (g01 a g06) con sus parámetros por defecto y muestra filas y tiempos.
 *
 * Uso: npm run cypher
 */
import { cerrarNeo4j } from '../src/config/neo4j';
import { CONSULTAS_CYPHER } from '../src/modules/graph/cypher';
import { ejecutarConsultaCypher, mapaDemanda, redAspirante } from '../src/modules/graph/graph.service';

async function main() {
  for (const c of CONSULTAS_CYPHER) {
    const r = await ejecutarConsultaCypher(c.id, {});
    console.log(`\n[${c.id}] ${c.titulo}`);
    console.log(`    ${r.total_filas} filas · ${r.duracion_ms} ms`);
    for (const fila of r.filas.slice(0, 4)) console.log('    ', JSON.stringify(fila).slice(0, 200));
  }

  const mapa = await mapaDemanda({});
  console.log(`\n[mapa-demanda] ${mapa.grafo.nodos.length} nodos, ${mapa.grafo.aristas.length} aristas · ${mapa.duracion_ms} ms`);
  const filtrado = await mapaDemanda({ departamento: 'quetzaltenango', anio_ingreso: '2019', solo_aprobados: 'si' });
  console.log(`[mapa-demanda filtrado] ${filtrado.grafo.nodos.length} nodos, ${filtrado.grafo.aristas.length} aristas · ${filtrado.duracion_ms} ms`);
  const red = await redAspirante('002682dc0bebeba427703d33aae5cb14');
  console.log(`[red-aspirante] ${red.grafo.nodos.length} nodos, ${red.grafo.aristas.length} aristas · ${red.duracion_ms} ms`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => cerrarNeo4j());
