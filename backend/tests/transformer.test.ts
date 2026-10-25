import assert from 'node:assert/strict';
import test from 'node:test';
import catalogoMunicipios from '../src/modules/etl/catalogos/municipios.json';
import { calcularEdad, MECANICA_SIN_PRECISAR, transformarCarrera, transformarUbicacion } from '../src/modules/etl/pipeline/transformer';

test('R-C4: la carrera truncada con espacio final NO se confunde con la carrera real', () => {
  const truncada = transformarCarrera('INGENIERIA MECANICA ');
  const real = transformarCarrera('INGENIERIA MECANICA');
  assert.equal(truncada.carrera, MECANICA_SIN_PRECISAR);
  assert.deepEqual(truncada.advertencias, ['CARRERA_AMBIGUA']);
  assert.equal(real.carrera, 'INGENIERIA MECANICA');
  assert.deepEqual(real.advertencias, []);
});

test('R-C1 y R-C2: NINGUNO pasa a null y la carrera cortada se completa', () => {
  assert.deepEqual(transformarCarrera('NINGUNO'), { carrera: null, advertencias: ['SIN_CARRERA'] });
  assert.deepEqual(transformarCarrera('INGENIERIA EN CIENCIAS Y '), {
    carrera: 'INGENIERIA EN CIENCIAS Y SISTEMAS',
    advertencias: ['CARRERA_COMPLETADA'],
  });
  assert.equal(transformarCarrera('INGENIERIA CIVIL').carrera, 'INGENIERIA CIVIL');
});

test('R-G4: las zonas de la capital se separan del municipio', () => {
  const u = transformarUbicacion('GUATEMALA', 'GUATEMALA - CIUDAD CAPITAL ZONA 13', 'PRIVADO');
  assert.equal(u.municipio, 'GUATEMALA');
  assert.equal(u.zona, 13);
  assert.deepEqual(u.advertencias, []);
});

test('R-G4b: en 2022-2024 la zona se pierde y queda marcada', () => {
  const u = transformarUbicacion('GUATEMALA', 'GUATEMALA - CIUDAD ', 'PRIVADO');
  assert.equal(u.municipio, 'GUATEMALA');
  assert.equal(u.zona, null);
  assert.deepEqual(u.advertencias, ['ZONA_NO_DISPONIBLE']);
});

test('R-G5: municipio truncado con un único candidato se recupera', () => {
  const u = transformarUbicacion('SACATEPEQUEZ', 'SAN LUCAS SACATEPEQ', 'PUBLICO');
  assert.equal(u.municipio, 'SAN LUCAS SACATEPEQUEZ');
  assert.deepEqual(u.advertencias, ['MUNICIPIO_RECUPERADO']);
});

test('R-G5: un nombre completo de 19 caracteres no se marca como truncado', () => {
  const u = transformarUbicacion('SOLOLA', 'SAN PEDRO LA LAGUNA', 'PUBLICO');
  assert.equal(u.municipio, 'SAN PEDRO LA LAGUNA');
  assert.deepEqual(u.advertencias, []);
});

test('R-G5: sin candidato en el catálogo se conserva recortado y se marca', () => {
  const u = transformarUbicacion('RETALHULEU', 'SAN MARTIN ', 'PUBLICO');
  assert.equal(u.municipio, 'SAN MARTIN');
  assert.deepEqual(u.advertencias, ['MUNICIPIO_TRUNCADO']);
});

test('R-G1: SIN DATOS pasa a null en los tres campos', () => {
  const u = transformarUbicacion('SIN DATOS', 'SIN DATOS', 'SIN DATOS');
  assert.equal(u.departamento, null);
  assert.equal(u.municipio, null);
  assert.equal(u.tipo_institucion, null);
  assert.deepEqual(u.advertencias, ['INSTITUCION_SIN_DATOS']);
});

test('R-G8: el departamento mal escrito QUEZALTENANGO se corrige a QUETZALTENANGO y queda marcado', () => {
  const u = transformarUbicacion('QUEZALTENANGO', 'QUETZALTENANGO', 'PUBLICO');
  assert.equal(u.departamento, 'QUETZALTENANGO');
  assert.equal(u.municipio, 'QUETZALTENANGO');
  assert.deepEqual(u.advertencias, ['DEPARTAMENTO_CORREGIDO']);
  // un departamento bien escrito no se toca ni se marca
  const g = transformarUbicacion('GUATEMALA', 'MIXCO', 'PRIVADO');
  assert.equal(g.departamento, 'GUATEMALA');
  assert.deepEqual(g.advertencias, []);
});

test('R-G8: el catálogo de municipios usa la grafía oficial del departamento', () => {
  const claves = Object.keys(catalogoMunicipios);
  assert.ok(claves.includes('QUETZALTENANGO'));
  assert.ok(!claves.includes('QUEZALTENANGO'));
});

test('R-ED: la edad válida va de 13 a 70 años', () => {
  assert.equal(calcularEdad(2019, 2000).edad, 19);
  assert.equal(calcularEdad(2015, 2002).edad, 13);
  assert.equal(calcularEdad(2015, 2003).edad, null); // 12 años
  assert.equal(calcularEdad(2020, 1950).edad, 70);
  assert.deepEqual(calcularEdad(2015, 1900), { edad: null, advertencias: ['EDAD_FUERA_DE_RANGO'] });
  assert.deepEqual(calcularEdad(2015, null), { edad: null, advertencias: ['SIN_ANIO_NACIMIENTO'] });
});
