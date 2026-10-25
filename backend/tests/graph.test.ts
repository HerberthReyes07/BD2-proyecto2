import assert from 'node:assert/strict';
import test from 'node:test';
import { leerParametros } from '../src/modules/analytics/queries/comun';
import { CONSULTAS_CYPHER, buscarConsultaCypher } from '../src/modules/graph/cypher';

test('Están registradas las 6 consultas Cypher, sin ids repetidos (el enunciado pide al menos 5)', () => {
  assert.equal(CONSULTAS_CYPHER.length, 6);
  assert.equal(new Set(CONSULTAS_CYPHER.map((c) => c.id)).size, 6);
  assert.equal(buscarConsultaCypher('g03')?.numero, 3);
  assert.equal(buscarConsultaCypher('g99'), undefined);
});

test('Cada consulta Cypher usa exactamente los parámetros que declara', () => {
  for (const c of CONSULTAS_CYPHER) {
    const usados = new Set([...c.cypher.matchAll(/\$([a-z_]+)/g)].map((m) => m[1]));
    const declarados = new Set(c.parametros.map((p) => p.nombre));
    assert.deepEqual([...usados].sort(), [...declarados].sort(), `${c.id}: parámetros usados vs declarados`);
  }
});

test('Cada consulta Cypher es de solo lectura', () => {
  for (const c of CONSULTAS_CYPHER) {
    assert.ok(!/\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH)\b/i.test(c.cypher), `${c.id} no debe modificar el grafo`);
  }
});

test('Los parámetros de las consultas Cypher tienen valores por defecto válidos', () => {
  for (const c of CONSULTAS_CYPHER) {
    assert.doesNotThrow(() => leerParametros(c.parametros, {}), c.id);
  }
});

test('g01 convierte el departamento a mayúsculas y rechaza nombres con caracteres raros', () => {
  const g01 = buscarConsultaCypher('g01')!;
  const p = leerParametros(g01.parametros, { departamento: 'guatemala' });
  assert.equal(g01.preparar!(p).departamento, 'GUATEMALA');
  assert.throws(() => leerParametros(g01.parametros, { departamento: 'x; MATCH (n) DETACH DELETE n' }));
});
