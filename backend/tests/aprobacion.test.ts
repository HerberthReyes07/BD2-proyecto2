import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularHabilitacion, derivarPersona, sumarDosAnios } from '../src/modules/etl/pipeline/aprobacion';
import { EvaluacionDoc, Materia } from '../src/modules/etl/etl.types';

/** Crea una evaluación de prueba. Solo hay que indicar lo que importa para cada caso. */
function ev(anio: number, oportunidad: number, materia: Materia, aprobada: boolean, fecha: string, carrera: string | null = 'INGENIERIA CIVIL'): EvaluacionDoc {
  return {
    _id: `${anio}|persona|${oportunidad}|${materia}`,
    aspirante_id: 'persona',
    correlativo_original: 'persona',
    anio_ingreso: anio,
    oportunidad,
    materia,
    fecha_asignacion: new Date(`${fecha}T00:00:00Z`),
    anio_mes: fecha.slice(0, 7),
    mes: Number(fecha.slice(5, 7)),
    aprobada,
    carrera,
    sexo: 'M',
    anio_nacimiento: 2000,
    edad: anio - 2000,
    departamento: 'GUATEMALA',
    municipio: 'GUATEMALA',
    zona: null,
    tipo_institucion: 'PUBLICO',
    advertencias: [],
    origen: { archivo: 'x.csv', linea: 2 },
  };
}

test('R-V1: la vigencia son 2 años calendario (el 29 de febrero pasa al 28)', () => {
  assert.equal(sumarDosAnios(new Date('2021-09-20T00:00:00Z')).toISOString().slice(0, 10), '2023-09-20');
  assert.equal(sumarDosAnios(new Date('2020-02-29T00:00:00Z')).toISOString().slice(0, 10), '2022-02-28');
});

test('Ejemplo del autor: Computación aprobada en la oportunidad 1 y Matemática en la 3 => APROBADO', () => {
  const persona = derivarPersona([
    ev(2022, 1, 'COMPUTACION', true, '2021-07-26'),
    ev(2022, 1, 'MATEMATICA', false, '2021-07-26'),
    ev(2022, 2, 'MATEMATICA', false, '2021-08-23'),
    ev(2022, 3, 'MATEMATICA', true, '2021-10-18'),
  ]);
  const p = persona.postulaciones[0];
  assert.equal(p.estado, 'APROBADO');
  assert.equal(p.aprobado, true);
  assert.equal(p.anio_habilitacion, 2022);
  assert.equal(p.aprobo_ambas_en_el_anio, true);
  const mate = p.materias.find((m) => m.materia === 'MATEMATICA')!;
  assert.equal(mate.intentos, 3);
  assert.equal(mate.intento_aprobacion, 3);
  assert.deepEqual(mate.oportunidades, [1, 2, 3]);
  const compu = p.materias.find((m) => m.materia === 'COMPUTACION')!;
  assert.equal(compu.intento_aprobacion, 1);
});

test('Aprobaciones en años distintos dentro de 2 años: se habilita en el año de la segunda', () => {
  const persona = derivarPersona([
    ev(2018, 2, 'COMPUTACION', true, '2017-10-10'),
    ev(2018, 2, 'MATEMATICA', false, '2017-10-10'),
    ev(2019, 1, 'MATEMATICA', true, '2018-08-13'),
  ]);
  const [p2018, p2019] = persona.postulaciones;
  assert.equal(p2018.estado, 'PARCIAL');
  assert.equal(p2018.aprobo_ambas_en_el_anio, false);
  assert.equal(p2019.estado, 'APROBADO');
  assert.equal(p2019.aprobo_ambas_en_el_anio, false); // el indicador complementario (a) NO lo cuenta
  assert.equal(persona.aspirante.habilitacion?.anio, 2019);
});

test('Si la primera aprobación ya venció (más de 2 años), no hay habilitación', () => {
  const hab = calcularHabilitacion([
    ev(2016, 1, 'COMPUTACION', true, '2015-08-31'),
    ev(2019, 1, 'MATEMATICA', true, '2018-09-03'),
  ]);
  assert.equal(hab, null);
});

test('El día exacto del vencimiento todavía cuenta como vigente', () => {
  const hab = calcularHabilitacion([
    ev(2016, 1, 'COMPUTACION', true, '2015-09-20'),
    ev(2018, 1, 'MATEMATICA', true, '2017-09-20'),
  ]);
  assert.equal(hab?.anio, 2018);
});

test('Con varios pares válidos se toma la habilitación más temprana', () => {
  const hab = calcularHabilitacion([
    ev(2016, 1, 'COMPUTACION', true, '2015-08-31'),
    ev(2016, 2, 'MATEMATICA', true, '2015-10-12'),
    ev(2017, 1, 'MATEMATICA', true, '2016-08-29'), // segunda aprobación de Matemática (anomalía)
  ]);
  assert.equal(hab?.anio, 2016);
  assert.equal(hab?.fecha.toISOString().slice(0, 10), '2015-10-12');
});

test('R-D3: una reprobación posterior a la aprobación no la revierte, pero queda marcada', () => {
  const persona = derivarPersona([
    ev(2015, 1, 'MATEMATICA', false, '2014-08-25'),
    ev(2015, 2, 'MATEMATICA', true, '2014-09-22'),
    ev(2015, 3, 'MATEMATICA', false, '2014-11-02'),
    ev(2015, 2, 'COMPUTACION', true, '2014-09-22'),
  ]);
  const p = persona.postulaciones[0];
  assert.equal(p.estado, 'APROBADO');
  assert.ok(p.advertencias.includes('REPROBACION_POSTERIOR_A_APROBACION'));
  assert.ok(persona.aspirante.advertencias.includes('REPROBACION_POSTERIOR_A_APROBACION'));
});

test('R-P1: el primer intento es la menor oportunidad del aspirante, no necesariamente la 1', () => {
  const persona = derivarPersona([
    ev(2020, 3, 'COMPUTACION', true, '2019-11-04'),
    ev(2020, 3, 'MATEMATICA', false, '2019-11-04'),
    ev(2020, 4, 'MATEMATICA', true, '2020-01-13'),
  ]);
  const p = persona.postulaciones[0];
  assert.equal(p.primer_intento.oportunidad, 3);
  assert.equal(p.primer_intento.reprobo, true); // reprobó Matemática en su primera aparición
  assert.equal(p.materias.find((m) => m.materia === 'MATEMATICA')!.intento_aprobacion, 2);
});

test('Un aspirante que reaparece después de habilitarse queda como YA_HABILITADO', () => {
  const persona = derivarPersona([
    ev(2017, 1, 'COMPUTACION', true, '2016-08-29'),
    ev(2017, 1, 'MATEMATICA', true, '2016-08-29'),
    ev(2018, 1, 'MATEMATICA', false, '2017-08-28'),
  ]);
  assert.deepEqual(
    persona.postulaciones.map((p) => p.estado),
    ['APROBADO', 'YA_HABILITADO'],
  );
});

test('Sin ninguna materia aprobada el estado es NO_APROBADO', () => {
  const persona = derivarPersona([ev(2021, 1, 'MATEMATICA', false, '2020-08-31')]);
  assert.equal(persona.postulaciones[0].estado, 'NO_APROBADO');
  assert.equal(persona.aspirante.habilitacion, null);
});
