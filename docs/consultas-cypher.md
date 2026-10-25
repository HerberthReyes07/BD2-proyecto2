# Consultas de Neo4j (Cypher)

> Documento generado automáticamente con `npm run doc:cypher` desde el código de `backend/src/modules/graph/`.
> El Cypher que se muestra es exactamente el que se ejecuta y los resultados son los del grafo cargado.

Cypher es el lenguaje de consultas de Neo4j. Los patrones se dibujan con paréntesis para los **nodos** y corchetes para las **relaciones**: `(p:Postulacion)-[:ASPIRA_A]->(c:Carrera)` se lee "una postulación que aspira a una carrera". `MATCH` busca el patrón, `WHERE` filtra, `WITH` encadena etapas y `RETURN` da la salida. Los nodos, relaciones y propiedades del modelo están en [modelo-neo4j.md](modelo-neo4j.md).

## Cómo ejecutarlas

- **API:** `GET /api/graph/consultas/{id}` (por ejemplo `/api/graph/consultas/g01?departamento=GUATEMALA&anio_ingreso=2019`).
- **Neo4j Browser:** abre `http://localhost:7474`, entra con el usuario `neo4j` y la contraseña de tu `.env`, define los parámetros con `:param` (por ejemplo `:param departamento => "GUATEMALA"` y `:param anio_ingreso => null`) y pega el Cypher. Los enteros se escriben sin comillas y un parámetro opcional sin valor se escribe `null`.

| # | Consulta | Qué demuestra |
|---|---|---|
| 1 | [Carreras más demandadas desde un departamento](#consulta-g1) | Recorrido de 3 relaciones; Filtro por propiedad de nodo; Agregación con count |
| 2 | [Pares de carreras que comparten aspirantes](#consulta-g2) | Patrón con un nodo intermedio compartido; Dos relaciones del mismo tipo; Filtro opcional por propiedad |
| 3 | [Aspirantes que cambian de carrera de un año al siguiente](#consulta-g3) | Recorrido que cruza años a través del aspirante; Aritmética sobre propiedades; Negación de patrones |
| 4 | [Aprobaron Matemática tras varios intentos, por tipo de institución](#consulta-g4) | Propiedades en relaciones; Filtro sobre propiedades de la relación; Unión con un segundo recorrido |
| 5 | [Flujo de aprobados: de qué departamentos a qué carreras](#consulta-g5) | Camino de varias relaciones; Propiedad de nodo dentro del patrón; Resultado como aristas ponderadas |
| 6 | [Aspirantes que postulan varios años y cuántos terminan aprobando](#consulta-g6) | Conteo de relaciones por nodo; Agregación en dos niveles con WITH; Comparación entre grupos |

<a id="consulta-g1"></a>

## Consulta 1 · Carreras más demandadas desde un departamento

Qué carreras eligen los aspirantes que proceden de un departamento, opcionalmente en un año de ingreso.

- **Endpoint:** `GET /api/graph/consultas/g01`
- **Gráfica en la interfaz:** barras
- **Demuestra:** Recorrido de 3 relaciones; Filtro por propiedad de nodo; Agregación con count

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `departamento` | texto | QUETZALTENANGO | Departamento de la institución (en mayúsculas, por ejemplo GUATEMALA) |
| `anio_ingreso` | entero | sin filtro | Limita la consulta a un año de ingreso |
| `limite` | entero | 10 | Cuántas carreras mostrar |

**Cómo funciona.** Recorre tres saltos del grafo: Carrera ← Postulacion → Municipio → Departamento. Se parte del nodo `Departamento` elegido, se sube por `PERTENECE_A` hasta sus `Municipio`, se baja por `PROCEDE_DE` hasta las `Postulacion` y se sigue `ASPIRA_A` hasta la `Carrera`. El filtro por año usa la propiedad `anio_ingreso` de la postulación; `$anio_ingreso IS NULL` hace que el filtro sea opcional.

```cypher
MATCH (d:Departamento {nombre: $departamento})<-[:PERTENECE_A]-(:Municipio)<-[:PROCEDE_DE]-(p:Postulacion)-[:ASPIRA_A]->(c:Carrera)
WHERE $anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso
RETURN c.nombre AS carrera,
       count(p) AS postulaciones,
       sum(CASE WHEN p.aprobado THEN 1 ELSE 0 END) AS aprobados
ORDER BY postulaciones DESC
LIMIT $limite
```

**Resultado con los parámetros por defecto** (10 filas; se muestran las primeras 8):

| carrera | postulaciones | aprobados |
|---|---|---|
| INGENIERIA EN CIENCIAS Y SISTEMAS | 162 | 19 |
| INGENIERIA CIVIL | 124 | 15 |
| INGENIERIA INDUSTRIAL | 68 | 7 |
| INGENIERIA QUIMICA | 65 | 20 |
| INGENIERIA ELECTRICA | 46 | 8 |
| INGENIERIA ELECTRONICA | 36 | 4 |
| INGENIERIA MECANICA ELECTRICA | 34 | 9 |
| INGENIERIA MECANICA | 29 | 4 |

<a id="consulta-g2"></a>

## Consulta 2 · Pares de carreras que comparten aspirantes

Qué carreras aparecen juntas en una misma postulación: aspirantes que dudan entre dos opciones.

- **Endpoint:** `GET /api/graph/consultas/g02`
- **Gráfica en la interfaz:** tabla
- **Demuestra:** Patrón con un nodo intermedio compartido; Dos relaciones del mismo tipo; Filtro opcional por propiedad

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | sin filtro | Limita la consulta a un año de ingreso |
| `limite` | entero | 10 | Cuántos pares mostrar |

**Cómo funciona.** Un patrón con dos relaciones `ASPIRA_A` que salen de la misma `Postulacion` hacia dos `Carrera` distintas. La condición `c1.nombre < c2.nombre` evita contar cada par dos veces (A–B y B–A). Es una consulta muy natural en grafos: dos nodos que se conectan a través de un tercero. En MongoDB habría que comparar arreglos de carreras.

```cypher
MATCH (c1:Carrera)<-[:ASPIRA_A]-(p:Postulacion)-[:ASPIRA_A]->(c2:Carrera)
WHERE c1.nombre < c2.nombre
  AND ($anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso)
RETURN c1.nombre AS carrera_a, c2.nombre AS carrera_b, count(p) AS postulaciones
ORDER BY postulaciones DESC
LIMIT $limite
```

**Resultado con los parámetros por defecto** (10 filas; se muestran las primeras 8):

| carrera_a | carrera_b | postulaciones |
|---|---|---|
| INGENIERIA CIVIL | INGENIERIA EN CIENCIAS Y SISTEMAS | 892 |
| INGENIERIA CIVIL | INGENIERIA INDUSTRIAL | 654 |
| INGENIERIA EN CIENCIAS Y SISTEMAS | INGENIERIA INDUSTRIAL | 446 |
| INGENIERIA ELECTRONICA | INGENIERIA EN CIENCIAS Y SISTEMAS | 354 |
| INGENIERIA CIVIL | INGENIERIA QUIMICA | 304 |
| INGENIERIA INDUSTRIAL | INGENIERIA MECANICA INDUSTRIAL | 297 |
| INGENIERIA ELECTRICA | INGENIERIA ELECTRONICA | 236 |
| INGENIERIA MECANICA | INGENIERIA MECANICA INDUSTRIAL | 209 |

<a id="consulta-g3"></a>

## Consulta 3 · Aspirantes que cambian de carrera de un año al siguiente

De qué carrera a qué carrera se mueven los aspirantes que vuelven a postular al año siguiente.

- **Endpoint:** `GET /api/graph/consultas/g03`
- **Gráfica en la interfaz:** tabla
- **Demuestra:** Recorrido que cruza años a través del aspirante; Aritmética sobre propiedades; Negación de patrones

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | sin filtro | Año al que llegan los aspirantes (el año siguiente al de origen) |
| `limite` | entero | 15 | Cuántos cambios mostrar |

**Cómo funciona.** El recorrido cruza dos años a través del nodo `Aspirante`: Carrera ← Postulacion (año N) ← Aspirante → Postulacion (año N+1) → Carrera. La condición `p2.anio_ingreso = p1.anio_ingreso + 1` limita a años consecutivos. Las dos negaciones `NOT (p)-[:ASPIRA_A]->(c)` descartan a quien conserva una de sus carreras, de modo que solo cuentan cambios reales. El parámetro `anio_ingreso`, si se indica, es el año al que llegan (N+1).

```cypher
MATCH (a:Aspirante)-[:POSTULO]->(p1:Postulacion)-[:ASPIRA_A]->(c1:Carrera),
      (a)-[:POSTULO]->(p2:Postulacion)-[:ASPIRA_A]->(c2:Carrera)
WHERE p2.anio_ingreso = p1.anio_ingreso + 1
  AND NOT (p2)-[:ASPIRA_A]->(c1)
  AND NOT (p1)-[:ASPIRA_A]->(c2)
  AND ($anio_ingreso IS NULL OR p2.anio_ingreso = $anio_ingreso)
RETURN c1.nombre AS desde, c2.nombre AS hacia, count(DISTINCT a) AS aspirantes
ORDER BY aspirantes DESC
LIMIT $limite
```

**Resultado con los parámetros por defecto** (15 filas; se muestran las primeras 8):

| desde | hacia | aspirantes |
|---|---|---|
| INGENIERIA EN CIENCIAS Y SISTEMAS | INGENIERIA INDUSTRIAL | 142 |
| INGENIERIA CIVIL | INGENIERIA INDUSTRIAL | 102 |
| INGENIERIA INDUSTRIAL | INGENIERIA EN CIENCIAS Y SISTEMAS | 81 |
| INGENIERIA ELECTRONICA | INGENIERIA EN CIENCIAS Y SISTEMAS | 72 |
| INGENIERIA EN CIENCIAS Y SISTEMAS | INGENIERIA ELECTRONICA | 69 |
| INGENIERIA CIVIL | INGENIERIA EN CIENCIAS Y SISTEMAS | 69 |
| INGENIERIA EN CIENCIAS Y SISTEMAS | INGENIERIA CIVIL | 54 |
| INGENIERIA INDUSTRIAL | INGENIERIA CIVIL | 51 |

<a id="consulta-g4"></a>

## Consulta 4 · Aprobaron Matemática tras varios intentos, por tipo de institución

Entre quienes aprobaron Matemática, cuántos lo lograron hasta su intento N o posterior, según el tipo de institución.

- **Endpoint:** `GET /api/graph/consultas/g04`
- **Gráfica en la interfaz:** barras_agrupadas
- **Demuestra:** Propiedades en relaciones; Filtro sobre propiedades de la relación; Unión con un segundo recorrido

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | sin filtro | Limita la consulta a un año de ingreso |
| `intento_minimo` | entero | 3 | Intento a partir del cual se considera "tras varios intentos" |

**Cómo funciona.** Filtra por una propiedad de la RELACIÓN: `EVALUADA_EN` guarda `aprobada` e `intento` (la posición de la evaluación entre las de esa materia en el año). Se parte de la `Materia` Matemática, se toman las evaluaciones aprobadas y se une cada postulación con su `TipoInstitucion`. `count(DISTINCT CASE ... END)` cuenta solo las postulaciones cuyo intento aprobado fue ≥ `intento_minimo`. Un aspirante con dos aprobaciones se cuenta una sola vez gracias a `DISTINCT`.

```cypher
MATCH (p:Postulacion)-[r:EVALUADA_EN]->(:Materia {nombre: 'MATEMATICA'})
WHERE r.aprobada
  AND ($anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso)
MATCH (p)-[:EN_INSTITUCION]->(t:TipoInstitucion)
WITH t.nombre AS tipo_institucion,
     count(DISTINCT p) AS aprobaron,
     count(DISTINCT CASE WHEN r.intento >= $intento_minimo THEN p END) AS tras_varios_intentos
RETURN tipo_institucion, aprobaron, tras_varios_intentos,
       round(100.0 * tras_varios_intentos / aprobaron, 2) AS porcentaje
ORDER BY aprobaron DESC
```

**Resultado con los parámetros por defecto** (4 filas):

| tipo_institucion | aprobaron | tras_varios_intentos | porcentaje |
|---|---|---|---|
| PRIVADO | 9631 | 3593 | 37.31 |
| PUBLICO | 1114 | 445 | 39.95 |
| POR COOPERATIVA | 80 | 36 | 45 |
| MUNICIPAL | 6 | 6 | 100 |

<a id="consulta-g5"></a>

## Consulta 5 · Flujo de aprobados: de qué departamentos a qué carreras

Combinaciones departamento → carrera con más aspirantes aprobados (habilitados).

- **Endpoint:** `GET /api/graph/consultas/g05`
- **Gráfica en la interfaz:** tabla
- **Demuestra:** Camino de varias relaciones; Propiedad de nodo dentro del patrón; Resultado como aristas ponderadas

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `anio_ingreso` | entero | sin filtro | Limita la consulta a un año de ingreso |
| `limite` | entero | 20 | Cuántos flujos mostrar |

**Cómo funciona.** Un camino largo del grafo: Departamento ← Municipio ← Postulacion → Carrera, pero restringido a las postulaciones con la propiedad `aprobado: true`, que se escribe directamente dentro del patrón del nodo. Cada fila es una "arista" departamento–carrera ponderada por el número de aprobados: es la misma información que dibuja el mapa de demanda del explorador de grafos.

```cypher
MATCH (d:Departamento)<-[:PERTENECE_A]-(:Municipio)<-[:PROCEDE_DE]-(p:Postulacion {aprobado: true})-[:ASPIRA_A]->(c:Carrera)
WHERE $anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso
RETURN d.nombre AS departamento, c.nombre AS carrera, count(p) AS aprobados
ORDER BY aprobados DESC, departamento, carrera
LIMIT $limite
```

**Resultado con los parámetros por defecto** (20 filas; se muestran las primeras 8):

| departamento | carrera | aprobados |
|---|---|---|
| GUATEMALA | INGENIERIA EN CIENCIAS Y SISTEMAS | 2338 |
| GUATEMALA | INGENIERIA INDUSTRIAL | 911 |
| GUATEMALA | INGENIERIA CIVIL | 760 |
| GUATEMALA | INGENIERIA QUIMICA | 674 |
| GUATEMALA | INGENIERIA ELECTRONICA | 554 |
| GUATEMALA | INGENIERIA MECANICA | 285 |
| GUATEMALA | INGENIERIA MECANICA INDUSTRIAL | 284 |
| GUATEMALA | INGENIERIA ELECTRICA | 271 |

<a id="consulta-g6"></a>

## Consulta 6 · Aspirantes que postulan varios años y cuántos terminan aprobando

Para quienes participaron en N años o más, cuántos llegaron a aprobar en alguno de ellos.

- **Endpoint:** `GET /api/graph/consultas/g06`
- **Gráfica en la interfaz:** barras
- **Demuestra:** Conteo de relaciones por nodo; Agregación en dos niveles con WITH; Comparación entre grupos

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `minimo_anios` | entero | 1 | Mínimo de años de participación |

**Cómo funciona.** Cuenta las relaciones `POSTULO` de cada `Aspirante` (cuántos años participó) y, con `max(CASE ...)`, si alguna de sus postulaciones quedó con `aprobado = true`. El primer `WITH` agrupa por aspirante; el `RETURN` vuelve a agrupar por número de años. Permite comparar el porcentaje de quienes terminan aprobando según cuántos años participaron.

```cypher
MATCH (a:Aspirante)-[:POSTULO]->(p:Postulacion)
WITH a, count(p) AS anios, max(CASE WHEN p.aprobado THEN 1 ELSE 0 END) AS aprobo
WHERE anios >= $minimo_anios
RETURN anios AS anios_de_participacion,
       count(a) AS aspirantes,
       sum(aprobo) AS aprobaron,
       round(100.0 * sum(aprobo) / count(a), 2) AS porcentaje_aprobaron
ORDER BY anios_de_participacion
```

**Resultado con los parámetros por defecto** (10 filas; se muestran las primeras 8):

| anios_de_participacion | aspirantes | aprobaron | porcentaje_aprobaron |
|---|---|---|---|
| 1 | 28229 | 6456 | 22.87 |
| 2 | 9105 | 1791 | 19.67 |
| 3 | 2016 | 200 | 9.92 |
| 4 | 548 | 19 | 3.47 |
| 5 | 192 | 5 | 2.6 |
| 6 | 69 | 0 | 0 |
| 7 | 28 | 0 | 0 |
| 8 | 5 | 0 | 0 |

## Vistas del explorador de grafos

El explorador no dibuja los 96,831 nodos de golpe: pide al backend un **subgrafo limitado por filtros**. Son dos vistas.

### Vista A · Mapa de demanda

Endpoint `GET /api/graph/mapa-demanda` con los filtros `anio_ingreso`, `departamento`, `solo_aprobados` (`si`/`no`) y `limite`. Cada arista municipio → carrera lleva como peso el número de postulaciones que las conectan; los departamentos agrupan a sus municipios.

```cypher
MATCH (d:Departamento)<-[:PERTENECE_A]-(m:Municipio)<-[:PROCEDE_DE]-(p:Postulacion)-[:ASPIRA_A]->(c:Carrera)
WHERE ($anio_ingreso IS NULL OR p.anio_ingreso = $anio_ingreso)
  AND ($departamento IS NULL OR d.nombre = $departamento)
  AND (NOT $solo_aprobados OR p.aprobado)
RETURN d.nombre AS departamento, m.id AS municipio_id, m.nombre AS municipio, c.nombre AS carrera, count(p) AS peso
ORDER BY peso DESC
LIMIT $limite
```

| Filtros | Nodos | Aristas |
|---|---|---|
| ninguno (límite 150 conexiones) | 69 | 188 |
| departamento QUETZALTENANGO, año 2019, solo aprobados | 12 | 13 |

### Vista B · Red de un aspirante

Endpoint `GET /api/graph/aspirante/{id}`. Muestra al aspirante, sus postulaciones, las carreras, el municipio y el tipo de institución de cada una, y una arista `EVALUADA_EN` por cada evaluación (con `oportunidad`, `aprobada` e `intento` como propiedades).

```cypher
MATCH (a:Aspirante {id: $id})-[po:POSTULO]->(p:Postulacion)
OPTIONAL MATCH (p)-[r:ASPIRA_A|PROCEDE_DE|EN_INSTITUCION|EVALUADA_EN]->(x)
RETURN a, po, p, r, x
```

Para el aspirante de ejemplo `002682dc0bebeba42770`: 8 nodos y 15 aristas.

## Verificación cruzada con MongoDB

Como los dos motores se llenan de las mismas colecciones derivadas, los resultados deben coincidir. Cada cifra de Neo4j se recalculó en MongoDB con un método distinto (`countDocuments`, `$all`, `$size` y un recorrido por aspirante), y todas coinciden:

| Consulta | Neo4j | MongoDB | Cómo se recalculó en MongoDB |
|---|---|---|---|
| g01 · Quetzaltenango, Ciencias y Sistemas | 162 | 162 | `countDocuments({departamento, carreras})` |
| g01 · Quetzaltenango, Ciencias y Sistemas, aprobados | 19 | 19 | igual, con `aprobado: true` |
| g02 · Civil + Ciencias y Sistemas | 892 | 892 | `carreras: { $all: [...] }` |
| g02 · Civil + Industrial | 654 | 654 | igual |
| g03 · Ciencias y Sistemas → Industrial | 142 | 142 | recorrido por aspirante comparando años consecutivos |
| g03 · Civil → Industrial | 102 | 102 | igual |
| g04 · Privadas, aprobaron Matemática | 9,631 | 9,631 | `materias: { $elemMatch }` |
| g04 · Privadas, aprobaron en el intento 3 o posterior | 3,593 | 3,593 | `$elemMatch` con `intento_aprobacion >= 3` |
| g05 · Guatemala, Ciencias y Sistemas, aprobados | 2,338 | 2,338 | `countDocuments` |
| g06 · Aspirantes con 1 año (y aprobaron) | 28,229 (6,456) | 28,229 (6,456) | `anios_ingreso: { $size: 1 }` |
| g06 · Aspirantes con 3 años (y aprobaron) | 2,016 (200) | 2,016 (200) | `anios_ingreso: { $size: 3 }` |
