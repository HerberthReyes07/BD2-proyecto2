import assert from 'node:assert/strict';
import test from 'node:test';
import { ParametroDef } from '../src/modules/analytics/analytics.types';
import { CONSULTAS, buscarConsulta } from '../src/modules/analytics/queries';
import { idAspiranteDesdeParametro, leerParametros } from '../src/modules/analytics/queries/comun';
import { AppError } from '../src/shared/errors/AppError';

test('Están registradas las 20 consultas, numeradas del 1 al 20 sin repetirse', () => {
  assert.equal(CONSULTAS.length, 20);
  assert.deepEqual(
    CONSULTAS.map((c) => c.numero),
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
  assert.equal(new Set(CONSULTAS.map((c) => c.id)).size, 20);
  assert.equal(buscarConsulta('q10')?.numero, 10);
  assert.equal(buscarConsulta('q99'), undefined);
});

test('Cada consulta produce un pipeline no vacío con sus parámetros por defecto', () => {
  for (const c of CONSULTAS) {
    const defs: ParametroDef[] = c.parametros.filter((p) => p.por_defecto !== undefined || !p.requerido);
    const params = leerParametros(defs, {});
    const pipeline = c.id === 'q11' || c.id === 'q15' ? c.construirPipeline({ aspirante_id: 'a'.repeat(20) }) : c.construirPipeline(params);
    assert.ok(Array.isArray(pipeline) && pipeline.length > 0, `${c.id} debe tener etapas`);
  }
});

test('Los parámetros tienen valor por defecto, se convierten a número y se validan', () => {
  const q10 = buscarConsulta('q10')!;
  assert.deepEqual(leerParametros(q10.parametros, {}), { edad_min: 16, edad_max: 18, limite: 5 });
  assert.deepEqual(leerParametros(q10.parametros, { edad_min: '19', edad_max: '21', limite: '3' }), { edad_min: 19, edad_max: 21, limite: 3 });
  assert.throws(() => leerParametros(q10.parametros, { edad_min: '5' }), AppError); // menor que el mínimo
  assert.throws(() => leerParametros(q10.parametros, { limite: 'tres' }), AppError); // no es entero
});

test('Los parámetros de tipo opción solo aceptan los valores permitidos', () => {
  const q16 = buscarConsulta('q16')!;
  assert.deepEqual(leerParametros(q16.parametros, {}), { criterio: 'alguna' });
  assert.deepEqual(leerParametros(q16.parametros, { criterio: 'todas' }), { criterio: 'todas' });
  assert.throws(() => leerParametros(q16.parametros, { criterio: 'ninguna' }), AppError);
});

test('El identificador del aspirante es obligatorio y se reduce a los primeros 20 caracteres', () => {
  const q11 = buscarConsulta('q11')!;
  assert.throws(() => leerParametros(q11.parametros, {}), AppError);
  assert.throws(() => leerParametros(q11.parametros, { aspirante_id: 'hola' }), AppError);
  const p = leerParametros(q11.parametros, { aspirante_id: '949D241AC10256EDF11339A303C72A50' });
  assert.equal(idAspiranteDesdeParametro(p), '949d241ac10256edf113');
});

test('El criterio "todas" de la consulta 16 cambia la condición del pipeline', () => {
  const q16 = buscarConsulta('q16')!;
  const alguna = JSON.stringify(q16.construirPipeline({ criterio: 'alguna' }));
  const todas = JSON.stringify(q16.construirPipeline({ criterio: 'todas' }));
  assert.ok(!alguna.includes('$anyElementTrue'));
  assert.ok(todas.includes('$anyElementTrue'));
});

test('El filtro por año agrega un $match solo cuando se indica', () => {
  const q02 = buscarConsulta('q02')!;
  assert.equal(JSON.stringify(q02.construirPipeline({})).includes('anio_ingreso'), false);
  assert.ok(JSON.stringify(q02.construirPipeline({ anio_ingreso: 2019 })).includes('"anio_ingreso":2019'));
});
