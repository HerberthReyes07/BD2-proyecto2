# Consultas de MongoDB

> Documento generado automáticamente con `npm run doc:consultas` desde el código de `backend/src/modules/analytics/queries/`.
> El pipeline que se muestra es exactamente el que se ejecuta y los resultados son los de la base cargada.

Las 20 consultas usan el **pipeline de agregación** de MongoDB: una cadena de etapas (`$match` filtra, `$unwind` convierte un arreglo en una fila por elemento, `$group` agrupa y calcula, `$sort` ordena, `$project` da forma a la salida) en la que cada etapa recibe el resultado de la anterior.

Las definiciones de "aprobado", "primer intento" y la unidad de conteo de cada consulta están en [reglas-etl.md](reglas-etl.md) y las colecciones en [modelo-mongodb.md](modelo-mongodb.md).

## Cómo ejecutarlas

- **API:** `GET /api/analytics/consultas/{id}` (por ejemplo `/api/analytics/consultas/q10?edad_min=16&edad_max=18`). Los parámetros opcionales van en la URL; casi todas aceptan `anio_ingreso`. La respuesta incluye las filas y el pipeline usado.
- **MongoDB Compass:** conéctate a `mongodb://localhost:27017`, abre la base `admision_usac`, entra a la colección indicada, pestaña **Aggregations**, cambia a modo **Text** y pega el arreglo del pipeline.
- **Terminal:** `db.<colección>.aggregate(<pipeline>)` en `mongosh`.

| # | Consulta | Colección | Gráfica |
|---|---|---|---|
| 1 | [Aspirantes por tipo de institución educativa](#consulta-1) | `aspirantes` | pastel |
| 2 | [Cantidad de evaluaciones aprobadas por materia](#consulta-2) | `evaluaciones` | barras |
| 3 | [Aspirantes aprobados por carrera y año de ingreso](#consulta-3) | `postulaciones` | barras_agrupadas |
| 4 | [Porcentaje de aprobación por materia](#consulta-4) | `evaluaciones` | barras_agrupadas |
| 5 | [Edad promedio por carrera](#consulta-5) | `postulaciones` | barras |
| 6 | [Colección auxiliar resumen_carrera](#consulta-6) | `postulaciones` | tabla |
| 7 | [Edad promedio de aprobados por carrera y tipo de institución](#consulta-7) | `postulaciones` | barras_agrupadas |
| 8 | [Distribución de aprobados por municipio y carrera](#consulta-8) | `postulaciones` | tabla |
| 9 | [Evaluaciones por mes y materia (instituciones públicas)](#consulta-9) | `evaluaciones` | lineas |
| 10 | [Top 5 de carreras más demandadas entre 16 y 18 años](#consulta-10) | `postulaciones` | barras |
| 11 | [Historial de desempeño por aspirante](#consulta-11) | `aspirantes` | tabla |
| 12 | [Distribución por sexo y tipo de institución educativa](#consulta-12) | `aspirantes` | barras_apiladas |
| 13 | [Tasa de aprobación por edad](#consulta-13) | `postulaciones` | lineas |
| 14 | [Número promedio de intentos por materia](#consulta-14) | `postulaciones` | barras |
| 15 | [Historial completo de un aspirante](#consulta-15) | `aspirantes` | detalle |
| 16 | [Carreras con más aspirantes reprobados en su primer intento](#consulta-16) | `postulaciones` | barras |
| 17 | [Top 5 de municipios con más aspirantes](#consulta-17) | `aspirantes` | barras |
| 18 | [Tasa de aprobación por tipo de institución educativa](#consulta-18) | `postulaciones` | barras |
| 19 | [Carreras más demandadas por departamento](#consulta-19) | `postulaciones` | tabla |
| 20 | [Evolución de la aprobación por año de ingreso](#consulta-20) | `evaluaciones` | barras_apiladas |

<a id="consulta-1"></a>

## Consulta 1 · Aspirantes por tipo de institución educativa

Cantidad de aspirantes (personas distintas) agrupados por el tipo de institución de la que proceden.

- **Colección:** `aspirantes`
- **Gráfica en la interfaz:** pastel
- **Endpoint:** `GET /api/analytics/consultas/q01`

**Cómo funciona.** La colección `aspirantes` tiene un documento por persona, así que contar documentos es contar personas. Se excluyen los aspirantes sin dato de institución (`SIN DATOS` pasó a `null` en el ETL).

```js
db.aspirantes.aggregate([
  {"$match":{"tipo_institucion":{"$ne":null}}},
  {"$group":{"_id":"$tipo_institucion","aspirantes":{"$sum":1}}},
  {"$sort":{"aspirantes":-1}},
  {"$project":{"_id":0,"tipo_institucion":"$_id","aspirantes":1}}
])
```

**Resultado** (4 filas):

| aspirantes | tipo_institucion |
|---|---|
| 33477 | PRIVADO |
| 5313 | PUBLICO |
| 434 | POR COOPERATIVA |
| 55 | MUNICIPAL |

<a id="consulta-2"></a>

## Consulta 2 · Cantidad de evaluaciones aprobadas por materia

Número de evaluaciones aprobadas, agrupadas por materia.

- **Colección:** `evaluaciones`
- **Gráfica en la interfaz:** barras
- **Endpoint:** `GET /api/analytics/consultas/q02`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Es una consulta a nivel de EVALUACIÓN (una fila del CSV): se filtran las evaluaciones con `aprobada = true` y se cuentan por materia. Un aspirante que aprueba una materia en su tercer intento aporta una sola evaluación aprobada.

```js
db.evaluaciones.aggregate([
  {"$match":{"aprobada":true}},
  {"$group":{"_id":"$materia","aprobadas":{"$sum":1}}},
  {"$sort":{"aprobadas":-1}},
  {"$project":{"_id":0,"materia":"$_id","aprobadas":1}}
])
```

**Resultado** (2 filas):

| aprobadas | materia |
|---|---|
| 18799 | COMPUTACION |
| 10898 | MATEMATICA |

<a id="consulta-3"></a>

## Consulta 3 · Aspirantes aprobados por carrera y año de ingreso

Cantidad de aspirantes aprobados (habilitados) agrupados por carrera objetivo y año de ingreso.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** barras_agrupadas
- **Endpoint:** `GET /api/analytics/consultas/q03`

**Cómo funciona.** Usa `postulaciones` (un aspirante en un año). Se filtran las postulaciones con `aprobado = true` (indicador principal: Matemática y Computación aprobadas con vigencia de 2 años por materia). `$unwind` convierte el arreglo `carreras` en una fila por carrera, de modo que una postulación con dos carreras cuenta en ambas. Las postulaciones sin carrera (casi todas de 2015, donde la carrera era `NINGUNO`) no aparecen aquí.

```js
db.postulaciones.aggregate([
  {"$match":{"aprobado":true}},
  {"$unwind":"$carreras"},
  {"$group":{"_id":{"carrera":"$carreras","anio_ingreso":"$anio_ingreso"},"aprobados":{"$sum":1}}},
  {"$sort":{"_id.anio_ingreso":1,"_id.carrera":1}},
  {"$project":{"_id":0,"anio_ingreso":"$_id.anio_ingreso","carrera":"$_id.carrera","aprobados":1}}
])
```

**Resultado** (94 filas; se muestran las primeras 8):

| aprobados | anio_ingreso | carrera |
|---|---|---|
| 14 | 2016 | INGENIERIA AMBIENTAL |
| 140 | 2016 | INGENIERIA CIVIL |
| 40 | 2016 | INGENIERIA ELECTRICA |
| 92 | 2016 | INGENIERIA ELECTRONICA |
| 325 | 2016 | INGENIERIA EN CIENCIAS Y SISTEMAS |
| 131 | 2016 | INGENIERIA INDUSTRIAL |
| 40 | 2016 | INGENIERIA MECANICA |
| 49 | 2016 | INGENIERIA MECANICA ELECTRICA |

<a id="consulta-4"></a>

## Consulta 4 · Porcentaje de aprobación por materia

Porcentaje de aprobación de cada materia, medido de dos maneras: por evaluación y por aspirante.

- **Colección:** `evaluaciones`
- **Gráfica en la interfaz:** barras_agrupadas
- **Endpoint:** `GET /api/analytics/consultas/q04`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Principal: aprobadas / evaluaciones (nivel evaluación, el mismo criterio de la consulta 2). Como quien reprueba vuelve a intentarlo, los reintentos fallidos bajan este porcentaje. Informativo: a nivel aspirante-materia-año (¿aprobó la materia en algún intento de ese año?), que se calcula con un `$lookup` a `postulaciones`. Es una medida mucho más alta y más cercana a la experiencia de una persona.

```js
db.evaluaciones.aggregate([
  {
    "$group": {"_id":"$materia","evaluaciones":{"$sum":1},"aprobadas":{"$sum":{"$cond":["$aprobada",1,0]}}}
  },
  {
    "$lookup": {
      "from": "postulaciones",
      "let": {"m":"$_id"},
      "pipeline": [
        {"$unwind":"$materias"},
        {"$match":{"$expr":{"$eq":["$materias.materia","$$m"]}}},
        {
          "$group": {
            "_id": null,
            "aspirantes": {"$sum":1},
            "aprobados": {"$sum":{"$cond":["$materias.aprobada",1,0]}}
          }
        }
      ],
      "as": "por_aspirante"
    }
  },
  {"$unwind":{"path":"$por_aspirante","preserveNullAndEmptyArrays":true}},
  {
    "$project": {
      "_id": 0,
      "materia": "$_id",
      "evaluaciones": 1,
      "aprobadas": 1,
      "porcentaje_evaluaciones": {"$round":[{"$multiply":[{"$divide":["$aprobadas","$evaluaciones"]},100]},2]},
      "aspirantes_materia": {"$ifNull":["$por_aspirante.aspirantes",0]},
      "aprobados_aspirante": {"$ifNull":["$por_aspirante.aprobados",0]},
      "porcentaje_aspirantes": {
        "$cond": [
          {"$gt":[{"$ifNull":["$por_aspirante.aspirantes",0]},0]},
          {
            "$round": [
              {
                "$multiply": [{"$divide":["$por_aspirante.aprobados","$por_aspirante.aspirantes"]},100]
              },
              2
            ]
          },
          null
        ]
      }
    }
  },
  {"$sort":{"evaluaciones":-1}}
])
```

**Resultado** (3 filas):

| evaluaciones | aprobadas | materia | porcentaje_evaluaciones | aspirantes_materia | aprobados_aspirante | porcentaje_aspirantes |
|---|---|---|---|---|---|---|
| 123830 | 10898 | MATEMATICA | 8.8 | 55865 | 10896 | 19.5 |
| 83754 | 18799 | COMPUTACION | 22.45 | 45476 | 18783 | 41.3 |
| 22 | 0 | MATEMATICA ITUGS | 0 | 14 | 0 | 0 |

<a id="consulta-5"></a>

## Consulta 5 · Edad promedio por carrera

Edad promedio de los aspirantes agrupados por carrera objetivo.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** barras
- **Endpoint:** `GET /api/analytics/consultas/q05`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Usa `postulaciones`. La edad es `anio_ingreso − anio_nacimiento` y se calculó en el ETL (R-ED1); las postulaciones sin edad válida (año de nacimiento `SIN REGISTRO` o fuera de 13–70) se excluyen con `$match`. `$unwind` sobre `carreras` cuenta cada postulación en cada una de sus carreras.

```js
db.postulaciones.aggregate([
  {"$match":{"edad":{"$ne":null}}},
  {"$unwind":"$carreras"},
  {"$group":{"_id":"$carreras","edad_promedio":{"$avg":"$edad"},"aspirantes":{"$sum":1}}},
  {"$sort":{"edad_promedio":1}},
  {
    "$project": {"_id":0,"carrera":"$_id","edad_promedio":{"$round":["$edad_promedio",2]},"aspirantes":1}
  }
])
```

**Resultado** (14 filas; se muestran las primeras 8):

| aspirantes | carrera | edad_promedio |
|---|---|---|
| 4599 | INGENIERIA QUIMICA | 19.92 |
| 17911 | INGENIERIA EN CIENCIAS Y SISTEMAS | 20.35 |
| 1850 | INGENIERIA MECANICA INDUSTRIAL | 20.54 |
| 900 | INGENIERIA AMBIENTAL | 20.73 |
| 3705 | INGENIERIA ELECTRONICA | 20.73 |
| 8387 | INGENIERIA INDUSTRIAL | 20.85 |
| 8654 | INGENIERIA CIVIL | 20.94 |
| 1127 | INGENIERIA MECANICA (INDUSTRIAL O ELECTRICA, SIN PRECISAR) | 20.94 |

<a id="consulta-6"></a>

## Consulta 6 · Colección auxiliar resumen_carrera

Genera (o actualiza) la colección `resumen_carrera` con un resumen por carrera y muestra su contenido.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** tabla
- **Endpoint:** `GET /api/analytics/consultas/q06`

**Cómo funciona.** El pipeline agrupa `postulaciones` por carrera (con `$unwind` sobre `carreras`), calcula totales, tasas y edades promedio, y termina con `$merge`, que escribe el resultado en la colección `resumen_carrera` en vez de devolverlo. Al terminar, la consulta lee esa colección para mostrarla. Se vuelve a generar sola después de cada carga de datos.

```js
db.postulaciones.aggregate([
  {"$match":{"carreras.0":{"$exists":true}}},
  {"$unwind":"$carreras"},
  {
    "$group": {
      "_id": {"carrera":"$carreras","anio":"$anio_ingreso"},
      "postulaciones": {"$sum":1},
      "aspirantes": {"$addToSet":"$aspirante_id"},
      "aprobados": {"$sum":{"$cond":["$aprobado",1,0]}},
      "aprobados_en_el_anio": {"$sum":{"$cond":["$aprobo_ambas_en_el_anio",1,0]}},
      "suma_edad": {"$sum":{"$ifNull":["$edad",0]}},
      "n_edad": {"$sum":{"$cond":[{"$gt":["$edad",null]},1,0]}},
      "suma_edad_aprobados": {"$sum":{"$cond":["$aprobado",{"$ifNull":["$edad",0]},0]}},
      "n_edad_aprobados": {"$sum":{"$cond":[{"$and":["$aprobado",{"$gt":["$edad",null]}]},1,0]}}
    }
  },
  {
    "$group": {
      "_id": "$_id.carrera",
      "postulaciones": {"$sum":"$postulaciones"},
      "aspirantes": {"$push":"$aspirantes"},
      "aprobados": {"$sum":"$aprobados"},
      "aprobados_en_el_anio": {"$sum":"$aprobados_en_el_anio"},
      "suma_edad": {"$sum":"$suma_edad"},
      "n_edad": {"$sum":"$n_edad"},
      "suma_edad_aprobados": {"$sum":"$suma_edad_aprobados"},
      "n_edad_aprobados": {"$sum":"$n_edad_aprobados"},
      "primer_anio": {"$min":"$_id.anio"},
      "ultimo_anio": {"$max":"$_id.anio"},
      "por_anio": {
        "$push": {"anio_ingreso":"$_id.anio","postulaciones":"$postulaciones","aprobados":"$aprobados"}
      }
    }
  },
  {
    "$project": {
      "carrera": "$_id",
      "postulaciones": 1,
      "aspirantes_distintos": {
        "$size": {
          "$reduce": {"input":"$aspirantes","initialValue":[],"in":{"$setUnion":["$$value","$$this"]}}
        }
      },
      "aprobados": 1,
      "tasa_aprobacion": {"$round":[{"$multiply":[{"$divide":["$aprobados","$postulaciones"]},100]},2]},
      "aprobados_en_el_anio": 1,
      "edad_promedio": {"$cond":[{"$gt":["$n_edad",0]},{"$round":[{"$divide":["$suma_edad","$n_edad"]},2]},null]},
      "edad_promedio_aprobados": {
        "$cond": [
          {"$gt":["$n_edad_aprobados",0]},
          {"$round":[{"$divide":["$suma_edad_aprobados","$n_edad_aprobados"]},2]},
          null
        ]
      },
      "primer_anio": 1,
      "ultimo_anio": 1,
      "por_anio": {"$sortArray":{"input":"$por_anio","sortBy":{"anio_ingreso":1}}},
      "generado_en": "$$NOW"
    }
  },
  {"$merge":{"into":"resumen_carrera","on":"_id","whenMatched":"replace","whenNotMatched":"insert"}}
])
```

**Resultado** (14 filas; se muestran las primeras 8):

| postulaciones | aprobados | aprobados_en_el_anio | primer_anio | ultimo_anio | carrera | aspirantes_distintos |
|---|---|---|---|---|---|---|
| 18588 | 2817 | 2291 | 2015 | 2024 | INGENIERIA EN CIENCIAS Y SISTEMAS | 14124 |
| 9062 | 1051 | 839 | 2016 | 2024 | INGENIERIA CIVIL | 7133 |
| 8760 | 1097 | 868 | 2016 | 2024 | INGENIERIA INDUSTRIAL | 7015 |
| 4816 | 902 | 741 | 2016 | 2024 | INGENIERIA QUIMICA | 3885 |
| 3858 | 692 | 553 | 2016 | 2024 | INGENIERIA ELECTRONICA | 2961 |
| 2876 | 356 | 289 | 2016 | 2024 | INGENIERIA MECANICA | 2276 |
| 2376 | 383 | 301 | 2016 | 2024 | INGENIERIA ELECTRICA | 1829 |
| 1965 | 352 | 274 | 2016 | 2021 | INGENIERIA MECANICA INDUSTRIAL | 1610 |

<a id="consulta-7"></a>

## Consulta 7 · Edad promedio de aprobados por carrera y tipo de institución

Edad promedio de los aspirantes aprobados, agrupada por carrera objetivo y tipo de institución educativa.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** barras_agrupadas
- **Endpoint:** `GET /api/analytics/consultas/q07`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Usa `postulaciones` con `aprobado = true` (indicador principal) y edad válida. Después de `$unwind` sobre `carreras` se agrupa por el par (carrera, tipo de institución). Se excluyen las postulaciones sin tipo de institución.

```js
db.postulaciones.aggregate([
  {"$match":{"aprobado":true,"edad":{"$ne":null},"tipo_institucion":{"$ne":null}}},
  {"$unwind":"$carreras"},
  {
    "$group": {
      "_id": {"carrera":"$carreras","tipo_institucion":"$tipo_institucion"},
      "edad_promedio": {"$avg":"$edad"},
      "aprobados": {"$sum":1}
    }
  },
  {"$sort":{"_id.carrera":1,"_id.tipo_institucion":1}},
  {
    "$project": {
      "_id": 0,
      "carrera": "$_id.carrera",
      "tipo_institucion": "$_id.tipo_institucion",
      "edad_promedio": {"$round":["$edad_promedio",2]},
      "aprobados": 1
    }
  }
])
```

**Resultado** (36 filas; se muestran las primeras 8):

| aprobados | carrera | tipo_institucion | edad_promedio |
|---|---|---|---|
| 106 | INGENIERIA AMBIENTAL | PRIVADO | 19.36 |
| 5 | INGENIERIA AMBIENTAL | PUBLICO | 19.8 |
| 1 | INGENIERIA CIVIL | MUNICIPAL | 20 |
| 5 | INGENIERIA CIVIL | POR COOPERATIVA | 20 |
| 876 | INGENIERIA CIVIL | PRIVADO | 19.71 |
| 103 | INGENIERIA CIVIL | PUBLICO | 20.7 |
| 4 | INGENIERIA ELECTRICA | POR COOPERATIVA | 19.75 |
| 305 | INGENIERIA ELECTRICA | PRIVADO | 19.9 |

<a id="consulta-8"></a>

## Consulta 8 · Distribución de aprobados por municipio y carrera

Cantidad de aspirantes aprobados según el municipio de su institución y la carrera objetivo.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** tabla
- **Endpoint:** `GET /api/analytics/consultas/q08`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |
| `limite` | entero | 200 | Máximo de filas a devolver |

**Cómo funciona.** Usa `postulaciones` con `aprobado = true`. Se agrupa por (departamento, municipio, carrera): el departamento forma parte de la clave porque hay municipios con el mismo nombre en departamentos distintos (R-G6). Se ordena de mayor a menor y se limita el número de filas (parámetro `limite`) porque hay cientos de combinaciones.

```js
db.postulaciones.aggregate([
  {"$match":{"aprobado":true,"departamento":{"$ne":null},"municipio":{"$ne":null}}},
  {"$unwind":"$carreras"},
  {
    "$group": {
      "_id": {"departamento":"$departamento","municipio":"$municipio","carrera":"$carreras"},
      "aprobados": {"$sum":1}
    }
  },
  {"$sort":{"aprobados":-1,"_id.departamento":1,"_id.municipio":1,"_id.carrera":1}},
  {"$limit":200},
  {
    "$project": {
      "_id": 0,
      "departamento": "$_id.departamento",
      "municipio": "$_id.municipio",
      "carrera": "$_id.carrera",
      "aprobados": 1
    }
  }
])
```

**Resultado** (200 filas; se muestran las primeras 8):

| aprobados | departamento | municipio | carrera |
|---|---|---|---|
| 1433 | GUATEMALA | GUATEMALA | INGENIERIA EN CIENCIAS Y SISTEMAS |
| 542 | GUATEMALA | GUATEMALA | INGENIERIA INDUSTRIAL |
| 477 | GUATEMALA | GUATEMALA | INGENIERIA CIVIL |
| 434 | GUATEMALA | MIXCO | INGENIERIA EN CIENCIAS Y SISTEMAS |
| 398 | GUATEMALA | GUATEMALA | INGENIERIA ELECTRONICA |
| 375 | GUATEMALA | GUATEMALA | INGENIERIA QUIMICA |
| 228 | GUATEMALA | VILLA NUEVA | INGENIERIA EN CIENCIAS Y SISTEMAS |
| 189 | GUATEMALA | GUATEMALA | INGENIERIA MECANICA |

<a id="consulta-9"></a>

## Consulta 9 · Evaluaciones por mes y materia (instituciones públicas)

Cantidad de evaluaciones realizadas cada mes, por materia, solo de aspirantes de instituciones públicas.

- **Colección:** `evaluaciones`
- **Gráfica en la interfaz:** lineas
- **Endpoint:** `GET /api/analytics/consultas/q09`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Usa `evaluaciones`. Se filtra `tipo_institucion = PUBLICO` y se agrupa por (año-mes, materia). El campo `anio_mes` (por ejemplo `2014-08`) se calculó en el ETL a partir de `fecha_asignacion`; agrupar por año-mes y no solo por mes del año da una serie de tiempo más informativa. Es un conteo de evaluaciones, no de personas.

```js
db.evaluaciones.aggregate([
  {"$match":{"tipo_institucion":"PUBLICO"}},
  {"$group":{"_id":{"anio_mes":"$anio_mes","materia":"$materia"},"evaluaciones":{"$sum":1}}},
  {"$sort":{"_id.anio_mes":1,"_id.materia":1}},
  {"$project":{"_id":0,"anio_mes":"$_id.anio_mes","materia":"$_id.materia","evaluaciones":1}}
])
```

**Resultado** (99 filas; se muestran las primeras 8):

| evaluaciones | anio_mes | materia |
|---|---|---|
| 408 | 2014-08 | COMPUTACION |
| 614 | 2014-08 | MATEMATICA |
| 206 | 2014-09 | COMPUTACION |
| 514 | 2014-09 | MATEMATICA |
| 219 | 2014-10 | COMPUTACION |
| 447 | 2014-10 | MATEMATICA |
| 29 | 2014-11 | COMPUTACION |
| 63 | 2014-11 | MATEMATICA |

<a id="consulta-10"></a>

## Consulta 10 · Top 5 de carreras más demandadas entre 16 y 18 años

Las carreras con más aspirantes dentro de un rango de edad (por defecto de 16 a 18 años).

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** barras
- **Endpoint:** `GET /api/analytics/consultas/q10`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |
| `edad_min` | entero | 16 | Edad mínima |
| `edad_max` | entero | 18 | Edad máxima |
| `limite` | entero | 5 | Cuántas carreras mostrar |

**Cómo funciona.** Usa `postulaciones`. Se filtra la edad con `$gte` y `$lte` (parámetros `edad_min` y `edad_max`, por defecto 16 y 18), se despliega `carreras`, se cuenta por carrera, se ordena de mayor a menor y `$limit` deja las primeras (`limite`, por defecto 5). La demanda es el número de postulaciones (aspirante + año de ingreso). No incluye postulaciones sin carrera.

```js
db.postulaciones.aggregate([
  {"$match":{"edad":{"$gte":16,"$lte":18}}},
  {"$unwind":"$carreras"},
  {"$group":{"_id":"$carreras","aspirantes":{"$sum":1}}},
  {"$sort":{"aspirantes":-1,"_id":1}},
  {"$limit":5},
  {"$project":{"_id":0,"carrera":"$_id","aspirantes":1}}
])
```

**Resultado** (5 filas):

| aspirantes | carrera |
|---|---|
| 3818 | INGENIERIA EN CIENCIAS Y SISTEMAS |
| 1374 | INGENIERIA CIVIL |
| 1361 | INGENIERIA INDUSTRIAL |
| 1182 | INGENIERIA QUIMICA |
| 409 | INGENIERIA ELECTRONICA |

<a id="consulta-11"></a>

## Consulta 11 · Historial de desempeño por aspirante

Evaluaciones, materias, intentos y resultados de un aspirante, año por año.

- **Colección:** `aspirantes`
- **Gráfica en la interfaz:** tabla
- **Endpoint:** `GET /api/analytics/consultas/q11`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `aspirante_id` | texto (obligatorio) | — | Identificador del aspirante (el correlativo de 20 o 32 caracteres) |

**Cómo funciona.** Se lee un solo documento de `aspirantes` (por su `_id`) y se despliega su arreglo embebido `historial`. Después de ordenar por año, oportunidad y fecha, `$group` arma una fila por (año de ingreso, materia) con el número de intentos, si aprobó (`$max` sobre booleanos: `true` es mayor que `false`) y el detalle de cada intento, que `$push` conserva en orden.

```js
db.aspirantes.aggregate([
  {"$match":{"_id":"002682dc0bebeba42770"}},
  {"$unwind":"$historial"},
  {"$sort":{"historial.anio_ingreso":1,"historial.oportunidad":1,"historial.fecha":1}},
  {
    "$group": {
      "_id": {"anio_ingreso":"$historial.anio_ingreso","materia":"$historial.materia"},
      "intentos": {"$sum":1},
      "aprobada": {"$max":"$historial.aprobada"},
      "detalle": {
        "$push": {
          "oportunidad": "$historial.oportunidad",
          "fecha": "$historial.fecha",
          "aprobada": "$historial.aprobada",
          "carrera": "$historial.carrera"
        }
      }
    }
  },
  {"$sort":{"_id.anio_ingreso":1,"_id.materia":1}},
  {
    "$project": {
      "_id": 0,
      "anio_ingreso": "$_id.anio_ingreso",
      "materia": "$_id.materia",
      "intentos": 1,
      "aprobada": 1,
      "detalle": 1
    }
  }
])
```

**Resultado** (3 filas; aspirante de ejemplo `002682dc0bebeba42770`):

| intentos | aprobada | detalle | anio_ingreso | materia |
|---|---|---|---|---|
| 2 | true | [{"oportunidad":2,"fecha":"2018-09-26T00:00:00.000Z","apr… | 2019 | COMPUTACION |
| 3 | false | [{"oportunidad":2,"fecha":"2018-09-26T00:00:00.000Z","apr… | 2019 | MATEMATICA |
| 2 | true | [{"oportunidad":1,"fecha":"2019-09-02T00:00:00.000Z","apr… | 2020 | MATEMATICA |

<a id="consulta-12"></a>

## Consulta 12 · Distribución por sexo y tipo de institución educativa

Cantidad de aspirantes (personas distintas) agrupados por sexo y por tipo de institución.

- **Colección:** `aspirantes`
- **Gráfica en la interfaz:** barras_apiladas
- **Endpoint:** `GET /api/analytics/consultas/q12`

**Cómo funciona.** Usa `aspirantes` (una fila por persona). Se agrupa por el par (sexo, tipo de institución). Los aspirantes sin sexo registrado (`null` desde el ETL) se muestran como `SIN REGISTRO` con `$ifNull`; los que no tienen tipo de institución se excluyen.

```js
db.aspirantes.aggregate([
  {"$match":{"tipo_institucion":{"$ne":null}}},
  {
    "$group": {
      "_id": {"sexo":{"$ifNull":["$sexo","SIN REGISTRO"]},"tipo_institucion":"$tipo_institucion"},
      "aspirantes": {"$sum":1}
    }
  },
  {"$sort":{"_id.tipo_institucion":1,"_id.sexo":1}},
  {
    "$project": {"_id":0,"tipo_institucion":"$_id.tipo_institucion","sexo":"$_id.sexo","aspirantes":1}
  }
])
```

**Resultado** (9 filas; se muestran las primeras 8):

| aspirantes | tipo_institucion | sexo |
|---|---|---|
| 10 | MUNICIPAL | F |
| 45 | MUNICIPAL | M |
| 102 | POR COOPERATIVA | F |
| 332 | POR COOPERATIVA | M |
| 7838 | PRIVADO | F |
| 25633 | PRIVADO | M |
| 6 | PRIVADO | SIN REGISTRO |
| 1213 | PUBLICO | F |

<a id="consulta-13"></a>

## Consulta 13 · Tasa de aprobación por edad

Porcentaje de aspirantes aprobados para cada edad.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** lineas
- **Endpoint:** `GET /api/analytics/consultas/q13`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Usa `postulaciones` con edad válida. Se agrupa por `edad` y se cuentan las postulaciones totales y las aprobadas (`aprobado = true`, indicador principal). La tasa es aprobados / total * 100. Las edades con muy pocos aspirantes (por encima de unos 40 años) dan porcentajes poco confiables: conviene mirar también la columna `aspirantes`.

```js
db.postulaciones.aggregate([
  {"$match":{"edad":{"$ne":null}}},
  {
    "$group": {"_id":"$edad","aspirantes":{"$sum":1},"aprobados":{"$sum":{"$cond":["$aprobado",1,0]}}}
  },
  {"$sort":{"_id":1}},
  {
    "$project": {
      "_id": 0,
      "edad": "$_id",
      "aspirantes": 1,
      "aprobados": 1,
      "tasa_aprobacion": {"$round":[{"$multiply":[{"$divide":["$aprobados","$aspirantes"]},100]},2]}
    }
  }
])
```

**Resultado** (46 filas; se muestran las primeras 8):

| aspirantes | aprobados | edad | tasa_aprobacion |
|---|---|---|---|
| 1 | 0 | 13 | 0 |
| 1 | 0 | 14 | 0 |
| 2 | 1 | 15 | 50 |
| 16 | 4 | 16 | 25 |
| 695 | 136 | 17 | 19.57 |
| 8080 | 1747 | 18 | 21.62 |
| 13883 | 2765 | 19 | 19.92 |
| 9934 | 1369 | 20 | 13.78 |

<a id="consulta-14"></a>

## Consulta 14 · Número promedio de intentos por materia

Promedio de oportunidades de evaluación que usan los aspirantes en cada materia dentro de un año de ingreso.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** barras
- **Endpoint:** `GET /api/analytics/consultas/q14`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Usa `postulaciones`, cuyo arreglo embebido `materias` ya trae `intentos` (cuántas evaluaciones tuvo esa materia en el año). `$unwind` da una fila por (postulación, materia) y se promedia por materia. Un "intento" es una aparición del aspirante, no el número de oportunidad: quien aparece por primera vez en la oportunidad 3 está en su intento 1.

```js
db.postulaciones.aggregate([
  {"$unwind":"$materias"},
  {
    "$group": {
      "_id": "$materias.materia",
      "promedio_intentos": {"$avg":"$materias.intentos"},
      "maximo_intentos": {"$max":"$materias.intentos"},
      "aspirantes": {"$sum":1}
    }
  },
  {"$sort":{"aspirantes":-1}},
  {
    "$project": {
      "_id": 0,
      "materia": "$_id",
      "promedio_intentos": {"$round":["$promedio_intentos",2]},
      "maximo_intentos": 1,
      "aspirantes": 1
    }
  }
])
```

**Resultado** (3 filas):

| maximo_intentos | aspirantes | materia | promedio_intentos |
|---|---|---|---|
| 5 | 55865 | MATEMATICA | 2.22 |
| 5 | 45476 | COMPUTACION | 1.84 |
| 4 | 14 | MATEMATICA ITUGS | 1.57 |

<a id="consulta-15"></a>

## Consulta 15 · Historial completo de un aspirante

Toda la información disponible de un aspirante identificado por su correlativo.

- **Colección:** `aspirantes`
- **Gráfica en la interfaz:** detalle
- **Endpoint:** `GET /api/analytics/consultas/q15`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `aspirante_id` | texto (obligatorio) | — | Identificador del aspirante (el correlativo de 20 o 32 caracteres) |

**Cómo funciona.** Se busca el documento de `aspirantes` por `_id` y `$lookup` trae todas sus `postulaciones` (la colección derivada, con el estado de aprobación de cada año). `$sortArray` ordena las postulaciones por año. El resultado reúne en un solo documento los datos de la persona, su habilitación, cada postulación y el historial completo de evaluaciones.

```js
db.aspirantes.aggregate([
  {"$match":{"_id":"002682dc0bebeba42770"}},
  {
    "$lookup": {"from":"postulaciones","localField":"_id","foreignField":"aspirante_id","as":"postulaciones"}
  },
  {
    "$project": {
      "correlativo_original": 1,
      "sexo": 1,
      "anio_nacimiento": 1,
      "tipo_institucion": 1,
      "departamento": 1,
      "municipio": 1,
      "anios_ingreso": 1,
      "habilitacion": 1,
      "advertencias": 1,
      "postulaciones": {"$sortArray":{"input":"$postulaciones","sortBy":{"anio_ingreso":1}}},
      "historial": 1
    }
  }
])
```

**Resultado** (1 fila; aspirante de ejemplo `002682dc0bebeba42770`):

```json
{
  "_id": "002682dc0bebeba42770",
  "correlativo_original": "002682dc0bebeba427703d33aae5cb14",
  "sexo": "M",
  "anio_nacimiento": 2001,
  "tipo_institucion": "PRIVADO",
  "departamento": "GUATEMALA",
  "municipio": "GUATEMALA",
  "anios_ingreso": [
    2019,
    2020
  ],
  "habilitacion": {
    "fecha": "2019-09-30T00:00:00.000Z",
    "anio": 2020
  },
  "advertencias": [],
  "postulaciones": [
    {
      "anio_ingreso": 2019,
      "estado": "PARCIAL",
      "carreras": [
        "INGENIERIA CIVIL"
      ],
      "n_evaluaciones": 5
    },
    {
      "anio_ingreso": 2020,
      "estado": "APROBADO",
      "carreras": [
        "INGENIERIA CIVIL"
      ],
      "n_evaluaciones": 2
    }
  ]
}
```

_(El campo `historial`, con todas las evaluaciones, se omite aquí por extensión.)_

<a id="consulta-16"></a>

## Consulta 16 · Carreras con más aspirantes reprobados en su primer intento

Carreras objetivo con mayor cantidad de aspirantes que no aprobaron en su primera aparición del año.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** barras
- **Endpoint:** `GET /api/analytics/consultas/q16`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |
| `criterio` | opcion | alguna | alguna = reprobó al menos una materia; todas = reprobó todas las que presentó |

**Cómo funciona.** El primer intento de un aspirante son las evaluaciones de su MENOR oportunidad en el año (no tiene que ser la 1; R-P1), que el ETL guardó en `primer_intento`. Con `criterio=alguna` (por defecto) cuenta como reprobado quien falló AL MENOS UNA materia en ese primer intento; con `criterio=todas` solo quien falló todas (`$anyElementTrue` sobre los resultados). Se despliegan las carreras del primer intento y se compara contra el total de aspirantes de esa carrera.

```js
db.postulaciones.aggregate([
  {"$unwind":"$primer_intento.carreras"},
  {
    "$group": {
      "_id": "$primer_intento.carreras",
      "aspirantes": {"$sum":1},
      "reprobados": {"$sum":{"$cond":["$primer_intento.reprobo",1,0]}}
    }
  },
  {"$sort":{"reprobados":-1,"_id":1}},
  {
    "$project": {
      "_id": 0,
      "carrera": "$_id",
      "aspirantes": 1,
      "reprobados": 1,
      "porcentaje_reprobados": {"$round":[{"$multiply":[{"$divide":["$reprobados","$aspirantes"]},100]},2]}
    }
  }
])
```

**Resultado** (14 filas; se muestran las primeras 8):

| aspirantes | reprobados | carrera | porcentaje_reprobados |
|---|---|---|---|
| 17908 | 17431 | INGENIERIA EN CIENCIAS Y SISTEMAS | 97.34 |
| 8175 | 7998 | INGENIERIA CIVIL | 97.83 |
| 7765 | 7593 | INGENIERIA INDUSTRIAL | 97.78 |
| 4544 | 4377 | INGENIERIA QUIMICA | 96.32 |
| 3424 | 3295 | INGENIERIA ELECTRONICA | 96.23 |
| 2527 | 2476 | INGENIERIA MECANICA | 97.98 |
| 2024 | 1957 | INGENIERIA ELECTRICA | 96.69 |
| 1580 | 1533 | INGENIERIA MECANICA INDUSTRIAL | 97.03 |

<a id="consulta-17"></a>

## Consulta 17 · Top 5 de municipios con más aspirantes

Los cinco municipios de procedencia de las instituciones con mayor cantidad de aspirantes.

- **Colección:** `aspirantes`
- **Gráfica en la interfaz:** barras
- **Endpoint:** `GET /api/analytics/consultas/q17`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `limite` | entero | 5 | Cuántos municipios mostrar |

**Cómo funciona.** Usa `aspirantes` (cada persona cuenta una vez). La clave de agrupación es (departamento, municipio), porque hay municipios con el mismo nombre en departamentos distintos (R-G6). La capital aparece como un solo municipio, `GUATEMALA`, sumando todas sus zonas (R-G4). `$concat` arma una etiqueta legible para la gráfica.

```js
db.aspirantes.aggregate([
  {"$match":{"departamento":{"$ne":null},"municipio":{"$ne":null}}},
  {
    "$group": {"_id":{"departamento":"$departamento","municipio":"$municipio"},"aspirantes":{"$sum":1}}
  },
  {"$sort":{"aspirantes":-1,"_id.departamento":1,"_id.municipio":1}},
  {"$limit":5},
  {
    "$project": {
      "_id": 0,
      "departamento": "$_id.departamento",
      "municipio": "$_id.municipio",
      "lugar": {"$concat":["$_id.municipio"," (","$_id.departamento",")"]},
      "aspirantes": 1
    }
  }
])
```

**Resultado** (5 filas):

| aspirantes | departamento | municipio | lugar |
|---|---|---|---|
| 19024 | GUATEMALA | GUATEMALA | GUATEMALA (GUATEMALA) |
| 4905 | GUATEMALA | MIXCO | MIXCO (GUATEMALA) |
| 3134 | GUATEMALA | VILLA NUEVA | VILLA NUEVA (GUATEMALA) |
| 1399 | CHIMALTENANGO | CHIMALTENANGO | CHIMALTENANGO (CHIMALTENANGO) |
| 938 | GUATEMALA | PETAPA | PETAPA (GUATEMALA) |

<a id="consulta-18"></a>

## Consulta 18 · Tasa de aprobación por tipo de institución educativa

Porcentaje de aspirantes aprobados en cada tipo de institución, para compararlos.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** barras
- **Endpoint:** `GET /api/analytics/consultas/q18`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |

**Cómo funciona.** Usa `postulaciones`. Se agrupa por `tipo_institucion` y se cuentan las postulaciones totales y las aprobadas (indicador principal). La tasa es aprobados / total * 100. Se excluyen las postulaciones sin tipo de institución.

```js
db.postulaciones.aggregate([
  {"$match":{"tipo_institucion":{"$ne":null}}},
  {
    "$group": {
      "_id": "$tipo_institucion",
      "aspirantes": {"$sum":1},
      "aprobados": {"$sum":{"$cond":["$aprobado",1,0]}}
    }
  },
  {"$sort":{"aspirantes":-1}},
  {
    "$project": {
      "_id": 0,
      "tipo_institucion": "$_id",
      "aspirantes": 1,
      "aprobados": 1,
      "tasa_aprobacion": {"$round":[{"$multiply":[{"$divide":["$aprobados","$aspirantes"]},100]},2]}
    }
  }
])
```

**Resultado** (4 filas):

| aspirantes | aprobados | tipo_institucion | tasa_aprobacion |
|---|---|---|---|
| 46369 | 7513 | PRIVADO | 16.2 |
| 8055 | 845 | PUBLICO | 10.49 |
| 637 | 65 | POR COOPERATIVA | 10.2 |
| 77 | 4 | MUNICIPAL | 5.19 |

<a id="consulta-19"></a>

## Consulta 19 · Carreras más demandadas por departamento

Las carreras con mayor demanda dentro de cada departamento de procedencia de la institución.

- **Colección:** `postulaciones`
- **Gráfica en la interfaz:** tabla
- **Endpoint:** `GET /api/analytics/consultas/q19`

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | — | Limita la consulta a un año de ingreso |
| `top` | entero | 3 | Cuántas carreras mostrar por departamento |

**Cómo funciona.** Usa `postulaciones`; la demanda es el número de postulaciones por carrera. Es un "top N por grupo": primero se cuenta por (departamento, carrera) y se ordena; luego un segundo `$group` junta las carreras de cada departamento en un arreglo ya ordenado (`$push`), `$slice` se queda con las primeras N (parámetro `top`) y `$unwind` con `includeArrayIndex` vuelve a convertirlas en filas numeradas (la posición en el ranking).

```js
db.postulaciones.aggregate([
  {"$match":{"departamento":{"$ne":null}}},
  {"$unwind":"$carreras"},
  {"$group":{"_id":{"departamento":"$departamento","carrera":"$carreras"},"demanda":{"$sum":1}}},
  {"$sort":{"_id.departamento":1,"demanda":-1,"_id.carrera":1}},
  {
    "$group": {"_id":"$_id.departamento","carreras":{"$push":{"carrera":"$_id.carrera","demanda":"$demanda"}}}
  },
  {"$project":{"top":{"$slice":["$carreras",3]}}},
  {"$unwind":{"path":"$top","includeArrayIndex":"indice"}},
  {"$sort":{"_id":1,"indice":1}},
  {
    "$project": {
      "_id": 0,
      "departamento": "$_id",
      "posicion": {"$add":["$indice",1]},
      "carrera": "$top.carrera",
      "demanda": "$top.demanda"
    }
  }
])
```

**Resultado** (69 filas; se muestran las primeras 8):

| departamento | posicion | carrera | demanda |
|---|---|---|---|
| ALTA VERAPAZ | 1 | INGENIERIA CIVIL | 258 |
| ALTA VERAPAZ | 2 | INGENIERIA EN CIENCIAS Y SISTEMAS | 166 |
| ALTA VERAPAZ | 3 | INGENIERIA INDUSTRIAL | 138 |
| BAJA VERAPAZ | 1 | INGENIERIA EN CIENCIAS Y SISTEMAS | 46 |
| BAJA VERAPAZ | 2 | INGENIERIA CIVIL | 44 |
| BAJA VERAPAZ | 3 | INGENIERIA INDUSTRIAL | 24 |
| CHIMALTENANGO | 1 | INGENIERIA EN CIENCIAS Y SISTEMAS | 782 |
| CHIMALTENANGO | 2 | INGENIERIA CIVIL | 416 |

<a id="consulta-20"></a>

## Consulta 20 · Evolución de la aprobación por año de ingreso

Cantidad y porcentaje de evaluaciones aprobadas y no aprobadas en cada año de ingreso.

- **Colección:** `evaluaciones`
- **Gráfica en la interfaz:** barras_apiladas
- **Endpoint:** `GET /api/analytics/consultas/q20`

**Cómo funciona.** Nivel EVALUACIÓN. Se agrupa `evaluaciones` por `anio_ingreso` contando el total y las aprobadas; las no aprobadas son la diferencia (`$subtract`) y los porcentajes se calculan sobre el total del año. Como cada intento fallido cuenta, los porcentajes son bajos aunque muchos aspirantes terminen aprobando: la consulta 4 y el indicador de aspirantes dan otra mirada.

```js
db.evaluaciones.aggregate([
  {
    "$group": {
      "_id": "$anio_ingreso",
      "evaluaciones": {"$sum":1},
      "aprobadas": {"$sum":{"$cond":["$aprobada",1,0]}}
    }
  },
  {"$sort":{"_id":1}},
  {
    "$project": {
      "_id": 0,
      "anio_ingreso": "$_id",
      "evaluaciones": 1,
      "aprobadas": 1,
      "no_aprobadas": {"$subtract":["$evaluaciones","$aprobadas"]},
      "porcentaje_aprobadas": {"$round":[{"$multiply":[{"$divide":["$aprobadas","$evaluaciones"]},100]},2]},
      "porcentaje_no_aprobadas": {
        "$round": [
          {
            "$multiply": [{"$divide":[{"$subtract":["$evaluaciones","$aprobadas"]},"$evaluaciones"]},100]
          },
          2
        ]
      }
    }
  }
])
```

**Resultado** (10 filas; se muestran las primeras 8):

| evaluaciones | aprobadas | anio_ingreso | no_aprobadas | porcentaje_aprobadas | porcentaje_no_aprobadas |
|---|---|---|---|---|---|
| 20266 | 4743 | 2015 | 15523 | 23.4 | 76.6 |
| 21987 | 3084 | 2016 | 18903 | 14.03 | 85.97 |
| 21398 | 3328 | 2017 | 18070 | 15.55 | 84.45 |
| 20678 | 3845 | 2018 | 16833 | 18.59 | 81.41 |
| 17835 | 3637 | 2019 | 14198 | 20.39 | 79.61 |
| 17665 | 3334 | 2020 | 14331 | 18.87 | 81.13 |
| 30642 | 1681 | 2021 | 28961 | 5.49 | 94.51 |
| 24231 | 1661 | 2022 | 22570 | 6.85 | 93.15 |
