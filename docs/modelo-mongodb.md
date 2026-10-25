# Modelo de MongoDB

Versión 1 · 22 de octubre de 2026 · Depende de [reglas-etl.md](reglas-etl.md)

MongoDB guarda los registros y responde las 20 consultas analíticas. Este documento define las colecciones,
sus campos, sus índices y cómo se llenan.

## 1. Conceptos rápidos

| Término | Qué es | Equivalente aproximado en SQL |
|---|---|---|
| **Documento** | Un registro en formato JSON (BSON) | Una fila |
| **Colección** | Un conjunto de documentos | Una tabla |
| **Embeber** | Guardar datos relacionados *dentro* del documento (un arreglo de subdocumentos) | Una tabla hija ya unida |
| **Referenciar** | Guardar solo el identificador de otro documento y buscarlo aparte (`$lookup`) | Una llave foránea |
| **Pipeline de agregación** | Cadena de etapas (`$match`, `$group`, `$unwind`, `$sort`…) que transforma documentos | `WHERE` + `GROUP BY` + `ORDER BY` |
| **Índice** | Estructura que acelera búsquedas por un campo | Igual que en SQL |

## 2. Qué se guarda y por qué

El diseño parte de tres "unidades" que piden las consultas (ver [§12 de reglas-etl.md](reglas-etl.md)):
la **evaluación** (una fila del CSV), la **postulación** (un aspirante en un año de ingreso) y la **persona**
(un aspirante en todos sus años). Cada unidad tiene su colección:

| Colección | Documentos | Qué es | Origen |
|---|---|---|---|
| `evaluaciones` | ≈ 207,606 | Una evaluación limpia (el "hecho" base) | Se carga desde el CSV |
| `postulaciones` | ≈ 56,337 | Un aspirante en un año de ingreso, con sus materias y su estado de aprobación | **Derivada** de `evaluaciones` |
| `aspirantes` | ≈ 40,197 | Una persona, con su historial completo | **Derivada** de `evaluaciones` |
| `resumen_carrera` | ≈ 14 | Resumen por carrera (consulta 6) | **Derivada** de `postulaciones` |
| `cargas` | 1 por archivo | Bitácora de cada carga | Generada por el ETL |
| `rechazados` | ≈ 850 o más | Filas rechazadas, con su causa | Generada por el ETL |

**Por qué derivar colecciones en vez de calcular todo al consultar.** El estado de aprobación (R-V1 a R-V3 en
[reglas-etl.md](reglas-etl.md)) compara fechas de aprobaciones de años distintos. Calcularlo una vez en el ETL,
con todo el historial a la vista, y guardarlo como un campo hace que las consultas sean pipelines cortos y fáciles
de explicar. Las colecciones derivadas se **reconstruyen completas** después de cada carga, porque cargar un
archivo nuevo puede cambiar el estado de aspirantes de años anteriores.

**Embeber o referenciar.** Se embebe cuando los datos siempre se leen juntos y su tamaño es pequeño y acotado:

| Dato embebido | Dónde | Tamaño máximo medido |
|---|---|---|
| Materias de una postulación | `postulaciones.materias` | 3 elementos |
| Carreras de una postulación | `postulaciones.carreras` | Pocas (solo 5,616 postulaciones tienen más de una) |
| Historial de una persona | `aspirantes.historial` | 38 evaluaciones (p99: 16) |

Las evaluaciones **no** se embeben dentro de las postulaciones: son la colección grande, se consultan por sí solas
(consultas 2, 4, 9, 20) y no conviene duplicarlas en cada lectura. Solo `aspirantes.historial` guarda una copia
compacta, para leer un historial completo con una sola consulta (11 y 15).

## 3. Colección `evaluaciones`

Una evaluación de un aspirante, en una materia, en una oportunidad de un año de ingreso. Ya viene limpia
según las reglas del ETL.

```json
{
  "_id": "2015|949d241ac10256edf113|1|MATEMATICA",
  "aspirante_id": "949d241ac10256edf113",
  "correlativo_original": "949d241ac10256edf11339a303c72a50",
  "anio_ingreso": 2015,
  "oportunidad": 1,
  "materia": "MATEMATICA",
  "fecha_asignacion": ISODate("2014-08-23"),
  "anio_mes": "2014-08",
  "mes": 8,
  "aprobada": false,
  "carrera": null,
  "sexo": "M",
  "anio_nacimiento": null,
  "edad": null,
  "departamento": "GUATEMALA",
  "municipio": "GUATEMALA",
  "zona": 1,
  "tipo_institucion": "PRIVADO",
  "advertencias": ["SIN_ANIO_NACIMIENTO", "SIN_CARRERA"],
  "origen": { "archivo": "pruebas_especificas_2015.csv", "linea": 2 }
}
```

(El ejemplo es la primera fila de `pruebas_especificas_2015.csv`.)

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | string | **Clave natural** `anio_ingreso\|aspirante_id\|oportunidad\|materia`. Es la clave de R-D1: un duplicado produce un error de clave repetida, que el ETL cuenta como "omitida" (R-D2). No hace falta un índice único aparte. |
| `aspirante_id` | string | Primeros 20 caracteres del correlativo (R-ID1) |
| `correlativo_original` | string | Correlativo tal como viene en el CSV (32 caracteres en 2015–2021, truncado en 2022–2024) |
| `anio_ingreso`, `oportunidad` | int | |
| `materia` | string | `MATEMATICA`, `COMPUTACION` o `MATEMATICA ITUGS` |
| `fecha_asignacion` | Date | Se guarda como fecha real, no como texto |
| `anio_mes`, `mes` | string, int | Derivados de la fecha, para la consulta 9 |
| `aprobada` | bool | Nivel 1 de aprobación |
| `carrera` | string o null | Atributo de la evaluación (R-C8) |
| `sexo`, `anio_nacimiento`, `edad` | string, int, int (pueden ser null) | `edad` según R-ED1 a R-ED3 |
| `departamento`, `municipio`, `zona`, `tipo_institucion` | string o null (`zona`: int) | Según §7 de reglas-etl |
| `advertencias` | arreglo de strings | Banderas del ETL |
| `origen` | subdocumento | Archivo y línea, para rastrear la fila hasta el CSV |

Los atributos del aspirante (sexo, geografía, carrera) se copian a cada evaluación a propósito: permite filtrar y
agrupar evaluaciones sin consultar otra colección, igual que una tabla de hechos con sus dimensiones.

## 4. Colección `postulaciones`

Un aspirante en un año de ingreso. Es la colección de las consultas "de aspirantes" (3, 5, 7, 8, 10, 13, 14, 16, 18, 19).

```json
{
  "_id": "2019|c1d2e3f4a5b6c7d8e9f0",
  "aspirante_id": "c1d2e3f4a5b6c7d8e9f0",
  "anio_ingreso": 2019,
  "sexo": "F",
  "anio_nacimiento": 2000,
  "edad": 19,
  "departamento": "QUETZALTENANGO",
  "municipio": "QUETZALTENANGO",
  "zona": null,
  "tipo_institucion": "PUBLICO",
  "carreras": ["INGENIERIA CIVIL"],
  "materias": [
    { "materia": "COMPUTACION", "aprobada": true,  "intentos": 1, "intento_aprobacion": 1,
      "fecha_primera_aprobacion": ISODate("2018-08-13"), "oportunidades": [1] },
    { "materia": "MATEMATICA",  "aprobada": true,  "intentos": 3, "intento_aprobacion": 3,
      "fecha_primera_aprobacion": ISODate("2018-11-12"), "oportunidades": [1, 2, 3] }
  ],
  "primer_intento": {
    "oportunidad": 1,
    "fecha": ISODate("2018-08-13"),
    "reprobo": true,
    "carreras": ["INGENIERIA CIVIL"],
    "resultados": [ { "materia": "COMPUTACION", "aprobada": true },
                    { "materia": "MATEMATICA",  "aprobada": false } ]
  },
  "n_evaluaciones": 4,
  "estado": "APROBADO",
  "aprobado": true,
  "anio_habilitacion": 2019,
  "fecha_habilitacion": ISODate("2018-11-12"),
  "aprobo_ambas_en_el_anio": true,
  "advertencias": []
}
```

(Los valores son ilustrativos: el ejemplo reproduce el caso de dos materias aprobadas en intentos distintos.)

| Campo | Notas |
|---|---|
| `_id` | `anio_ingreso\|aspirante_id` |
| `sexo`, `anio_nacimiento`, `edad`, `departamento`, `municipio`, `zona`, `tipo_institucion` | Son **constantes dentro de una postulación** (se verificó: 0 conflictos), por eso van como campos simples |
| `carreras` | Arreglo de carreras **distintas y no nulas** de sus evaluaciones (R-C8). Se usa con `$unwind` para agrupar por carrera |
| `materias` | Nivel 2 de aprobación. Es un **arreglo de subdocumentos** y no un objeto con claves `MATEMATICA`/`COMPUTACION`: los pipelines pueden recorrerlo con `$unwind` |
| `materias[].intentos` | Evaluaciones de esa materia en el año |
| `materias[].intento_aprobacion` | Posición del intento en que aprobó (null si no aprobó) |
| `primer_intento` | R-P1 a R-P3: evaluaciones de la menor oportunidad del año. `reprobo` = al menos una `NO APROBADO` |
| `estado` | `APROBADO`, `YA_HABILITADO`, `PARCIAL` o `NO_APROBADO` (§10.3 de reglas-etl) |
| `aprobado` | Indicador **principal** (c): `estado = APROBADO` |
| `anio_habilitacion`, `fecha_habilitacion` | Cuándo se habilitó la persona (null si nunca) |
| `aprobo_ambas_en_el_anio` | Indicador **complementario** (a) |

## 5. Colección `aspirantes`

Una persona con todo su historial. Es la colección de las consultas 1, 11, 12, 15, 17 y del buscador por aspirante.

(Ejemplo ilustrativo: el identificador y el historial son inventados.)

```json
{
  "_id": "a1b2c3d4e5f6a7b8c9d0",
  "correlativo_original": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "sexo": "M",
  "anio_nacimiento": 1996,
  "tipo_institucion": "PRIVADO",
  "departamento": "GUATEMALA",
  "municipio": "GUATEMALA",
  "anios_ingreso": [2015, 2016],
  "habilitacion": { "anio": 2016, "fecha": ISODate("2015-10-12") },
  "historial": [
    { "anio_ingreso": 2015, "oportunidad": 1, "fecha": ISODate("2014-08-23"),
      "materia": "MATEMATICA", "aprobada": false, "carrera": null },
    { "anio_ingreso": 2016, "oportunidad": 3, "fecha": ISODate("2015-10-12"),
      "materia": "MATEMATICA", "aprobada": true, "carrera": "INGENIERIA CIVIL" }
  ],
  "advertencias": []
}
```

| Campo | Notas |
|---|---|
| `_id` | `aspirante_id`. Una búsqueda por prefijo del ID usa este índice |
| `correlativo_original` | El valor original más largo visto (R-ID1) |
| `sexo`, `anio_nacimiento` | Si hay conflicto entre años, el valor del año más reciente (R-ID3) |
| `tipo_institucion`, `departamento`, `municipio` | De su **postulación más reciente con dato**. Solo 12 de 11,796 aspirantes que reaparecen cambian de institución, así que una persona cuenta una sola vez en las consultas 1, 12 y 17 |
| `habilitacion` | Año y fecha de su habilitación (null si nunca) |
| `historial` | Evaluaciones ordenadas por año, oportunidad y fecha |

## 6. Colección `resumen_carrera` (consulta 6)

Una fila por carrera, generada con un pipeline `$unwind` + `$group` + `$merge` sobre `postulaciones`.

```json
{
  "_id": "INGENIERIA CIVIL",
  "carrera": "INGENIERIA CIVIL",
  "postulaciones": 0,
  "aspirantes_distintos": 0,
  "aprobados": 0,
  "tasa_aprobacion": 0.0,
  "aprobados_en_el_anio": 0,
  "edad_promedio": 0.0,
  "edad_promedio_aprobados": 0.0,
  "primer_anio": 2015,
  "ultimo_anio": 2024,
  "por_anio": [ { "anio_ingreso": 2015, "postulaciones": 0, "aprobados": 0 } ],
  "generado_en": ISODate("2026-10-22")
}
```

(Los números se calculan al ejecutar la consulta; `tasa_aprobacion` va en porcentaje, de 0 a 100.) Incluye ambos indicadores: `aprobados` (principal) y
`aprobados_en_el_anio` (complementario). Las postulaciones sin carrera (`carreras` vacío) no generan fila.

## 7. Colecciones `cargas` y `rechazados`

**`cargas`**: una por archivo procesado. Reúne lo que exige el enunciado (nombre, leídos, correctos, rechazados,
tiempo y estado) y más. Los números de los ejemplos de esta sección son ilustrativos.

```json
{
  "_id": ObjectId("..."),
  "archivo": "pruebas_especificas_2015.csv",
  "iniciada_en": ISODate("..."),
  "finalizada_en": ISODate("..."),
  "duracion_ms": 0,
  "estado": "COMPLETADA_CON_ERRORES",
  "leidos": 20277,
  "cargados": 20266,
  "rechazados": 11,
  "omitidos": 0,
  "rechazos_por_causa": { "DUPLICADO": 11 },
  "advertencias_por_tipo": { "SIN_CARRERA": 20275 },
  "neo4j": { "estado": "COMPLETADA", "nodos_creados": 0, "relaciones_creadas": 0, "duracion_ms": 0 },
  "error": null
}
```

Se cumple siempre: `leidos = cargados + rechazados + omitidos`. Estados posibles: `EN_PROCESO`, `COMPLETADA`,
`COMPLETADA_CON_ERRORES` (hubo rechazos) y `FALLIDA` (error de archivo o de conexión).

**`rechazados`**: una por fila rechazada.

```json
{
  "carga_id": ObjectId("..."),
  "archivo": "pruebas_especificas_2016.csv",
  "linea": 4821,
  "causa": "DUPLICADO",
  "detalle": "Misma clave que la línea 1103; difiere en fecha_asignacion",
  "valores_originales": { "fecha_asignacion": "2015-07-02", "materia": "MATEMATICA" },
  "registrado_en": ISODate("...")
}
```

## 8. Índices

Todos se crean al iniciar el backend con `createIndex` (es idempotente: si ya existe, no hace nada).

| Colección | Índice | Para qué |
|---|---|---|
| `evaluaciones` | `_id` (ya existe) | Unicidad y omitir duplicados (R-D2) |
| | `{ aspirante_id: 1, anio_ingreso: 1, oportunidad: 1 }` | Reconstruir las colecciones derivadas, leyendo por aspirante en orden |
| | `{ materia: 1, aprobada: 1 }` | Consultas 2 y 4 |
| | `{ anio_ingreso: 1, aprobada: 1 }` | Consulta 20 |
| | `{ tipo_institucion: 1, anio_mes: 1, materia: 1 }` | Consulta 9 |
| `postulaciones` | `_id` (ya existe) | |
| | `{ aspirante_id: 1 }` | Unir con el historial de una persona |
| | `{ anio_ingreso: 1, aprobado: 1 }` | Consultas 3, 13, 18 y filtros del dashboard |
| | `{ carreras: 1 }` (multiclave) | Filtro por carrera |
| | `{ departamento: 1, municipio: 1 }` | Consulta 8, 19 y buscador |
| | `{ edad: 1 }` | Consultas 10 y 13 |
| `aspirantes` | `_id` (ya existe) | Consultas 11 y 15, y buscador por aspirante |
| `cargas` | `{ iniciada_en: -1 }` | Listar cargas recientes |
| `rechazados` | `{ carga_id: 1, causa: 1 }` | Ver los rechazos de una carga |

Los índices se justifican con las consultas reales. Si alguno no se usa al final, se elimina, y la
documentación de consultas incluirá el resultado de `explain()` de las más importantes.

## 9. Qué colección responde cada consulta

| Consulta | Colección | Resumen del pipeline |
|---|---|---|
| 1 Aspirantes por tipo de institución | `aspirantes` | `$match` tipo no nulo, `$group` por tipo |
| 2 Aprobados por materia | `evaluaciones` | `$match` aprobada, `$group` por materia |
| 3 Aprobados por carrera y año | `postulaciones` | `$match` aprobado, `$unwind` carreras, `$group` por carrera y año |
| 4 % de aprobación por materia | `evaluaciones` | `$group` por materia: aprobadas / total |
| 5 Edad promedio por carrera | `postulaciones` | `$match` edad no nula, `$unwind` carreras, `$avg` |
| 6 `resumen_carrera` | `postulaciones` | `$unwind`, `$group`, `$merge` |
| 7 Edad promedio de aprobados por carrera y tipo | `postulaciones` | `$match` aprobado y edad, `$unwind`, `$group` por carrera y tipo |
| 8 Aprobados por municipio y carrera | `postulaciones` | `$match` aprobado, `$unwind`, `$group` por departamento, municipio y carrera |
| 9 Evaluaciones por mes y materia (públicas) | `evaluaciones` | `$match` tipo PUBLICO, `$group` por año-mes y materia |
| 10 Top 5 carreras de 16 a 18 años | `postulaciones` | `$match` edad 16–18, `$unwind`, `$group`, `$sort`, `$limit` 5 |
| 11 Historial de desempeño | `aspirantes` | Lectura por `_id`, agrupando por materia y año |
| 12 Sexo y tipo de institución | `aspirantes` | `$group` por sexo y tipo |
| 13 Tasa de aprobación por edad | `postulaciones` | `$match` edad no nula, `$group` por edad |
| 14 Promedio de intentos por materia | `postulaciones` | `$unwind` materias, `$avg` de `intentos` |
| 15 Historial completo | `aspirantes` + `postulaciones` | Lectura por `_id` y `$lookup` |
| 16 Reprobados en primer intento por carrera | `postulaciones` | `$match` `primer_intento.reprobo`, `$unwind` sus carreras, `$group`, `$sort` |
| 17 Top 5 municipios | `aspirantes` | `$group` por departamento y municipio, `$sort`, `$limit` 5 |
| 18 Tasa de aprobación por tipo de institución | `postulaciones` | `$group` por tipo |
| 19 Carreras más demandadas por departamento | `postulaciones` | `$unwind`, `$group` por departamento y carrera, ranking dentro del departamento |
| 20 Evolución de aprobación por año | `evaluaciones` | `$group` por año y resultado, con porcentaje |

## 10. Cómo se llena MongoDB

1. **Al iniciar el backend:** se crean los índices.
2. **Por cada archivo:** se lee en streaming, se valida y se transforma (R-E, R-ID, R-C, R-G, R-ED), se
   eliminan duplicados dentro del archivo (R-D1) y se insertan en lotes de 5,000 con `insertMany` y
   `ordered: false`. Los errores de clave repetida se cuentan como `omitidos`. Las filas rechazadas van a `rechazados`.
3. **Al terminar todos los archivos de la solicitud:** se reconstruyen `aspirantes`, `postulaciones` y
   `resumen_carrera`. El ETL (en Node) lee `evaluaciones` ordenadas por aspirante, calcula en memoria el nivel 2,
   el primer intento y la habilitación de cada persona (regla de las fechas de §10.3), y escribe con `replaceOne`
   `upsert`. El cálculo se hace en código y no en el pipeline porque la regla de pares de aprobaciones con
   vigencia por materia es más clara en código.
4. **Después:** se sincroniza Neo4j (ver [modelo-neo4j.md](modelo-neo4j.md)) y se cierra el documento de `cargas`.

## 11. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Consulta 9: "por mes" | Se agrupa por año-mes (`2014-08`), que da una serie más informativa. El campo `mes` queda disponible para agrupar por mes del año |
| Consulta 19: cuántas carreras por departamento | Las 3 más demandadas de cada departamento (parámetro `top`) |
| Consultas 1, 12 y 17 | Cada persona cuenta una sola vez, con los datos de su postulación más reciente |
| Validación de esquema con `$jsonSchema` en `evaluaciones` | Opcional; solo si sobra tiempo |

Las 20 consultas están implementadas y documentadas en [consultas-mongodb.md](consultas-mongodb.md).
