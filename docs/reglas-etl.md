# Reglas de ETL

Versión 1 · 22 de octubre de 2026

Este documento define cómo se leen, validan, transforman y cargan los archivos CSV de *Pruebas específicas*
(Facultad de Ingeniería, USAC), y cómo se interpreta "aprobado". Cada regla tiene un código (`R-xx`) para
poder citarla desde el código, las consultas y los demás documentos.

Salvo que se indique lo contrario, las cantidades se refieren a las 208,453 filas originales de los 10 archivos.

---

## 1. Fuente de datos

Fuente: [Datos Abiertos – Facultad de Ingeniería – Pruebas específicas](https://datosabiertos.ingenieria.usac.edu.gt/dataset/pruebas-especificas).
Cada fila es **una evaluación**: un aspirante, en una materia, en una oportunidad de un año de ingreso.

| Archivo | Filas | Archivo | Filas |
|---|---|---|---|
| `pruebas_especificas_2015.csv` | 20,277 | `pruebas_especificas_2020.csv` | 17,931 |
| `pruebas_especificas_2016.csv` | 22,137 | `pruebas_especificas_2021.csv` | 30,644 |
| `pruebas_especificas_2017.csv` | 21,581 | `pruebas_especificas_2022.csv` | 24,237 |
| `pruebas_especificas_2018.csv` | 20,871 | `pruebas_especificas_2023.csv` | 19,047 |
| `pruebas_especificas_2019.csv` | 17,865 | `pruebas_especificas_2024.csv` | 13,863 |
| | | **Total** | **208,453** |

Resumen del perfilado:

| Medida | Valor |
|---|---|
| Codificación / saltos de línea | UTF-8 sin BOM, LF |
| Filas con número de columnas incorrecto | 0 |
| Filas únicas tras quitar duplicados | 207,606 |
| Aspirantes (personas) distintos | 40,197 |
| Postulaciones (aspirante + año de ingreso) | 56,337 |
| Aspirantes que aparecen en 2 o más años | 11,968 (30 %) |
| Oportunidades observadas | 1 a 4 (y 5 en 2023–2024) |

El publicador no documenta los problemas de estructura y truncado descritos abajo.

---

## 2. Estructura de los archivos

Los archivos 2015–2021 y 2022–2024 **no tienen la misma estructura**:

| Aspecto | 2015–2021 | 2022–2024 |
|---|---|---|
| Orden de columnas | `correlativo_aspirante` es la última | `correlativo_aspirante` es la 2.ª |
| Encabezados | Completos | Cortados: `numero_de_fecha_de_evaluaci`, `departamento_institucion_ed`, `municipio_institucion_` |
| Valores largos | Completos | Truncados (ver §5, §6 y §7) |

| Código | Regla |
|---|---|
| R-E1 | Las columnas se leen **por nombre, nunca por posición**. |
| R-E2 | Un encabezado se acepta si es prefijo (sin distinguir mayúsculas) de **exactamente un** nombre canónico. |
| R-E3 | Si falta una columna requerida o un encabezado no se reconoce, el archivo termina con estado `FALLIDO` y no se carga ninguna fila. |
| R-E4 | Se usa un lector CSV estándar: hay valores entrecomillados y otros no (`"1997"` frente a `1997`). |
| R-E5 | Una fila con distinto número de columnas que el encabezado se rechaza con causa `ESTRUCTURA_INVALIDA` (0 casos observados). |

---

## 3. Rechazos y advertencias

**Nada se elimina ni se corrige sin dejar registro.**

- **Rechazo:** la fila no se carga en MongoDB ni en Neo4j. Se guarda en la colección `rechazados` con archivo, número de línea, causa y valores originales.
- **Advertencia:** la fila sí se carga y lleva una bandera en su arreglo `advertencias`.

Causas de rechazo: `ESTRUCTURA_INVALIDA`, `CAMPO_REQUERIDO_VACIO`, `FECHA_INVALIDA`, `SEXO_INVALIDO`,
`ANIO_NACIMIENTO_INVALIDO`, `MATERIA_INVALIDA`, `OPORTUNIDAD_INVALIDA`, `ANIO_INGRESO_INVALIDO`,
`APROBACION_INVALIDA`, `TIPO_INSTITUCION_INVALIDO`, `CORRELATIVO_INVALIDO`, `DUPLICADO`.

Advertencias de evaluación: `SEXO_SIN_REGISTRO`, `SIN_ANIO_NACIMIENTO`, `EDAD_FUERA_DE_RANGO`, `SIN_CARRERA`,
`CARRERA_COMPLETADA`, `CARRERA_AMBIGUA`, `INSTITUCION_SIN_DATOS`, `ZONA_NO_DISPONIBLE`,
`MUNICIPIO_RECUPERADO`, `MUNICIPIO_TRUNCADO`, `ANIO_INGRESO_DISTINTO_DE_ARCHIVO`.

Advertencias de aspirante o materia: `CONFLICTO_SEXO`, `REPROBACION_POSTERIOR_A_APROBACION`, `MULTIPLE_APROBACION`.

---

## 4. Reglas por campo

| Campo | Regla | Resultado | Casos |
|---|---|---|---|
| `fecha_asignacion` | Formato `AAAA-MM-DD` y fecha real. Si no, se rechaza (`FECHA_INVALIDA`). | Tipo `Date`. Se derivan `mes` (1–12) y `anio_fecha`. | 0 inválidas |
| `sexo` | `M` o `F`. `SIN REGISTRO` pasa a `null`. Cualquier otro valor se rechaza. | `M`, `F` o `null` + `SEXO_SIN_REGISTRO` | 188 |
| `anio_nacimiento` | Entero de 4 dígitos. `SIN REGISTRO` pasa a `null`. Cualquier otro valor se rechaza. | Entero o `null` + `SIN_ANIO_NACIMIENTO` | 19,451 (9.3 %); 14,192 son de 2015 |
| `materia` | `MATEMATICA`, `COMPUTACION` o `MATEMATICA ITUGS` (valor propio). Otro valor se rechaza. | Texto | `MATEMATICA ITUGS`: 22 |
| `numero_de_fecha_de_evaluacion` | Entero ≥ 1. Si no, se rechaza (`OPORTUNIDAD_INVALIDA`). | Campo `oportunidad` | Valores 1 a 5 |
| `anio_de_ingreso` | Entero de 4 dígitos; si no, se rechaza (`ANIO_INGRESO_INVALIDO`). Si el nombre del archivo trae un año distinto, se avisa. | Entero | 0 discrepancias |
| `aprobacion` | `APROBADO` pasa a `true`, `NO APROBADO` a `false`. Otro valor se rechaza. | Booleano `aprobada` | 0 inválidos |
| `correlativo_aspirante` | Ver §5. | `aspirante_id` | — |
| `carrera_objetivo` | Ver §6. | `carrera` | — |
| `departamento_…`, `municipio_…`, `tipo_…` | Ver §7. | — | — |

Todo texto se normaliza a mayúsculas, con espacios extremos recortados y espacios internos colapsados.
**Excepción:** los valores de carrera y municipio se evalúan crudos antes de recortar (ver R-C4 y R-G5).

---

## 5. Identificador del aspirante

| Código | Regla |
|---|---|
| R-ID1 | `aspirante_id` = **los primeros 20 caracteres** del correlativo, en minúscula. Se conserva el valor original en `correlativo_original`. |
| R-ID2 | El correlativo debe cumplir `^[0-9a-f]{20,32}$`. Si no, se rechaza (`CORRELATIVO_INVALIDO`). |
| R-ID3 | Si un mismo aspirante muestra sexos distintos entre años, se usa el valor del año más reciente y se marca `CONFLICTO_SEXO`. |

**Por qué 20 caracteres.** En 2015–2021 el ID tiene 32 caracteres hexadecimales y en 2022–2024 está truncado a 20–23:

- Los 29,418 IDs completos de 2015–2021 dan 29,418 prefijos de 20 caracteres distintos (no hay colisiones).
- Los 2,174 IDs de 2022–2024 que coinciden con uno anterior son, sin excepción, prefijo exacto del ID de 32 caracteres.
- No hay conflictos de año de nacimiento entre los 11,096 aspirantes que reaparecen con año conocido. Solo 2 de 40,143 aspirantes cambian de sexo entre años, y solo 12 de 11,796 cambian de tipo o departamento de institución.
- La tasa de reaparición entre años consecutivos no se rompe en el cambio de formato (2020→2021: 27.4 %, 2021→2022: 24.4 %).

**Límite:** con IDs anónimos no se puede detectar a una misma persona con dos códigos distintos.

---

## 6. Carrera

| Código | Regla | Casos |
|---|---|---|
| R-C1 | `NINGUNO` pasa a `carrera = null` + `SIN_CARRERA`. | 20,275 de las 20,277 filas de 2015 |
| R-C2 | `INGENIERIA EN CIENCIAS Y ` (truncado) pasa a `INGENIERIA EN CIENCIAS Y SISTEMAS` + `CARRERA_COMPLETADA`. | 24,221 (2022–2024) |
| R-C3 | `INGENIERIA MECANICA ` (**con espacio final**) pasa a `INGENIERIA MECANICA (INDUSTRIAL O ELECTRICA, SIN PRECISAR)` + `CARRERA_AMBIGUA`. | 3,789 (2022–2024) |
| R-C4 | R-C2 y R-C3 se aplican al **valor crudo, antes de recortar espacios**. Si se recortara primero, `INGENIERIA MECANICA ` se confundiría con `INGENIERIA MECANICA` (la carrera real). | — |
| R-C5 | El resto de carreras solo se normaliza (mayúsculas, espacios). | — |
| R-C6 | `ITUGS` se conserva (22 filas, siempre con materia `MATEMATICA ITUGS`). No participa en el estado de aprobación (§10). | 22 |
| R-C7 | Las licenciaturas en Física y Matemática Aplicada (solo 2016–2019) se conservan. | — |
| R-C8 | La carrera es **atributo de la evaluación**, no del aspirante: 5,621 de 56,337 postulaciones (10 %) tienen más de una. En agrupaciones por carrera, una postulación cuenta **una vez por cada carrera distinta**. | 5,616 postulaciones con más de una carrera (sin contar `null`, tras quitar duplicados) |

Supuesto: en 2022–2024, `INGENIERIA MECANICA` (sin espacio) es la carrera Mecánica propiamente dicha.
No se puede verificar, porque no se conoce la regla de truncado del origen.

---

## 7. Geografía e institución

| Código | Regla | Casos |
|---|---|---|
| R-G1 | `SIN DATOS` en tipo, departamento y municipio (siempre aparecen juntos) pasa a `null` en los tres + `INSTITUCION_SIN_DATOS`. | 4,005 |
| R-G2 | `EXTRANJERO` se conserva como valor de departamento y de municipio. | 168 |
| R-G3 | Tipos válidos: `PRIVADO`, `PUBLICO`, `POR COOPERATIVA`, `MUNICIPAL` (y `SIN DATOS`, que pasa a `null`). Otro valor se rechaza (`TIPO_INSTITUCION_INVALIDO`). | — |
| R-G4 | `GUATEMALA - CIUDAD CAPITAL ZONA N` se separa en `municipio = GUATEMALA` y `zona = N` (22 zonas distintas observadas: 1 a 19, 21, 24 y 25). | 2015–2021 |
| R-G4b | En 2022–2024 el valor viene como `GUATEMALA - CIUDAD ` (truncado a 19 caracteres): `municipio = GUATEMALA`, `zona = null` + `ZONA_NO_DISPONIBLE`. | 25,579 |
| R-G5 | **Municipios truncados** (valor crudo de 19 caracteres o con espacio final, solo 2022–2024). Se busca en el catálogo de 2015–2021, en el mismo departamento, un nombre que empiece con el prefijo recortado. Si el valor ya aparece tal cual en el catálogo (por ejemplo `SAN PEDRO LA LAGUNA`, que mide justo 19 caracteres) se considera completo y no lleva advertencia. Si hay **un único** candidato se sustituye (`MUNICIPIO_RECUPERADO`). Si no hay ninguno se conserva recortado (`MUNICIPIO_TRUNCADO`). | 2,439 recuperados; 23 sin candidato (`SAN MARTIN` en Retalhuleu, `SAN SEBASTIAN` en Huehuetenango y `SAN CARLOS` en Quetzaltenango) |
| R-G6 | La clave geográfica es **(departamento, municipio)**: hay nombres repetidos en departamentos distintos (`SAN JOSE`, `SANTA LUCIA`, `SAN ANDRES`, entre otros). | — |
| R-G7 | `PUEBLO NUEVO VIÑAS` se conserva con la Ñ (UTF-8). | 1 municipio |

R-G5 es una regla adicional pensada para evitar nodos duplicados en Neo4j (por ejemplo, `SAN LUCAS SACATEPEQ`
junto a `SAN LUCAS SACATEPEQUEZ`).

---

## 8. Edad

| Código | Regla |
|---|---|
| R-ED1 | `edad = anio_de_ingreso − anio_nacimiento`. Es la misma en todos los intentos de un ciclo. Usar el año de `fecha_asignacion` daría edades distintas entre intentos. |
| R-ED2 | Una edad es válida entre **13 y 70**. Fuera de ese rango pasa a `null` + `EDAD_FUERA_DE_RANGO`; la fila se conserva. |
| R-ED3 | Las filas con edad `null` se excluyen de las consultas de edad (5, 7, 10, 13). |

Observado: rango real de 13 a 63; el 79 % de las filas con año de nacimiento tiene entre 18 y 21 años; 14 filas
tienen entre 13 y 15. Solo 4 filas quedan fuera del rango (un aspirante con año 1900, edad 115–116).

---

## 9. Duplicados y anomalías

| Caso | Cantidad | Regla |
|---|---|---|
| **Fila repetida** (misma clave `anio_de_ingreso + aspirante_id + oportunidad + materia`) | 818 grupos, **847 filas sobrantes**: 805 idénticos, 8 difieren solo en `fecha_asignacion`, 5 en fecha y carrera. Por año: 2015 (11), 2016 (150), 2017 (183), 2018 (193), 2019 (30), 2020 (266), 2021 (2), 2022 (6), 2024 (6). | **R-D1:** se conserva la de fecha más temprana (empate: la primera del archivo). Las demás se rechazan con causa `DUPLICADO`, guardando archivo, línea y campos que difieren. Ninguna repetida tiene resultado contradictorio. |
| Re-carga del mismo archivo | — | **R-D2:** las filas cuya clave ya existe en MongoDB no se reinsertan; se reportan como "omitidas (ya cargadas)", no como rechazadas. |
| Reprobación posterior a una aprobación (misma materia) | 184 aspirante-materia (0.6 % de las 29,679 con alguna aprobación): 170 filas `NO APROBADO` en el mismo año y 47 en años posteriores | **R-D3:** la evaluación se conserva, la materia sigue aprobada y se marca `REPROBACION_POSTERIOR_A_APROBACION`. **Una aprobación nunca se revierte.** |
| Segunda aprobación de la misma materia | 18 (todas en el mismo año) | **R-D4:** se usa la primera (por año, oportunidad y fecha) y se marca `MULTIPLE_APROBACION`. |
| Misma materia presentada en varios años | 17,406 de 78,723 aspirante-materia (22.1 %) | No es anomalía: cada año de ingreso se evalúa por separado. |
| Cambio de sexo entre años | 2 aspirantes | R-ID3 |
| Con ambas materias aprobadas antes, reaparece | 2 postulaciones (2021) | Estado `YA_HABILITADO` (§10). |

---

## 10. Definiciones de aprobación

### 10.1 Tres niveles

| Nivel | Qué es | Regla |
|---|---|---|
| **1. Evaluación** | Una fila del CSV | `aprobada` = valor del campo `aprobacion`, sin interpretar. |
| **2. Materia del aspirante** | Aspirante + año de ingreso + materia | Aprobada si **algún** intento fue `APROBADO`. |
| **3. Estado del aspirante** | Aspirante + año de ingreso (**postulación**) | Se calcula con los dos indicadores de §10.3. |

Nivel 2, campos: `aprobada`, `fecha_primera_aprobacion` (por año, oportunidad y fecha), `intentos` (evaluaciones de
esa materia en el año) e `intento_de_aprobacion` (posición de la evaluación aprobada entre sus intentos). Un
"intento" es una aparición del aspirante, no el número de oportunidad: quien aparece por primera vez en la
oportunidad 3 está en su intento 1.

### 10.2 Vigencia

- **R-V1:** una aprobación de **una materia** vence **2 años calendario** después de la fecha de la prueba (mismo día y mes; el 29 de febrero pasa al 28).
- **R-V2:** la vigencia se aplica **por materia**, no al conjunto.
- **R-V3:** como fecha de la prueba se usa `fecha_asignacion`.

### 10.3 Indicadores del estado del aspirante

**Indicador principal (c): habilitado con vigencia por materia** — es el valor por defecto de las consultas de "aspirantes aprobados".

Un aspirante está **habilitado** cuando existen una aprobación de Matemática y una de Computación (en cualquier año)
tales que la más reciente de las dos se obtuvo dentro de los 2 años posteriores a la más antigua.

- Si hay varios pares válidos, se toma la **habilitación más temprana**: la que tiene la fecha más antigua de segunda aprobación.
- `anio_habilitacion` = año de ingreso de la evaluación que completa el par.
- Cada persona se cuenta como aprobada **una sola vez**, en el año de su habilitación.

Estado de cada postulación:

| Estado | Condición | Casos |
|---|---|---|
| `APROBADO` | `anio_habilitacion` = año de la postulación | **8,471 (15.0 %)** |
| `YA_HABILITADO` | Se habilitó en un año anterior y reaparece | 2 |
| `PARCIAL` | No habilitado, pero con al menos una materia aprobada hasta ese año (sin mirar vigencia; solo informativo) | 20,928 |
| `NO_APROBADO` | Ninguna materia aprobada hasta ese año | 26,936 |

**Indicador complementario (a): `aprobo_ambas_en_el_anio`.** Ambas materias tienen alguna evaluación `APROBADO`
entre las filas del propio año de ingreso. Es la cota verificable solo con el CSV: **7,011 (12.4 %)**.

| Año | Postulaciones | (c) APROBADO | (a) Ambas en el año |
|---|---|---|---|
| 2015 | 6,148 | 910 (14.8 %) | 910 |
| 2016 | 6,428 | 908 (14.1 %) | 628 |
| 2017 | 5,976 | 1,012 (16.9 %) | 839 |
| 2018 | 5,738 | 1,071 (18.7 %) | 896 |
| 2019 | 5,310 | 1,216 (22.9 %) | 857 |
| 2020 | 4,997 | 986 (19.7 %) | 774 |
| 2021 | 6,861 | 449 (6.5 %) | 354 |
| 2022 | 6,380 | 447 (7.0 %) | 386 |
| 2023 | 4,638 | 765 (16.5 %) | 713 |
| 2024 | 3,861 | 707 (18.3 %) | 654 |
| **Total** | **56,337** | **8,471 (15.0 %)** | **7,011 (12.4 %)** |

La diferencia de 1,460 son aspirantes que completaron las dos materias en ciclos distintos (en su gran mayoría,
Computación en un ciclo anterior y Matemática en el actual). Los dos indicadores deben mostrarse siempre con su
etiqueta y no mezclarse.

`MATEMATICA ITUGS` (14 postulaciones) no participa en ninguno de los dos indicadores.

### 10.4 Fundamento de la vigencia

- **Norma:** el artículo 43 del Reglamento del Sistema de Ubicación y Nivelación (SUN) establece que el resultado satisfactorio de las Pruebas Específicas tiene vigencia de dos años desde la fecha de su publicación. Su texto es idéntico en las dos versiones del reglamento consultadas.
- **Práctica del SUN:** una constancia de resultados SUN-CUNOC aportada por el autor lista cada materia con su propia fecha y vencimiento, a exactamente 2 años de la fecha de la prueba. Eso sustenta que la vigencia es por materia y que se cuenta desde la fecha de la prueba. La constancia no se incluye en el repositorio porque contiene datos personales.
- **Comportamiento observado:** de 11,315 postulaciones con una sola materia, 8,354 (73.8 %) tienen la otra aprobada en un año anterior.
- **Robustez del resultado:** medir contra la última evaluación del año da 8,471; contra el 31 de enero, 8,387; con pares de vigencia simultánea acumulados, 8,473; sin límite de años (descartado por no tener respaldo normativo), 8,659.

---

## 11. Primer intento

| Código | Regla |
|---|---|
| R-P1 | El **primer intento** de un aspirante en un año de ingreso son las evaluaciones con la **menor oportunidad** que tuvo en ese año. No tiene que ser la oportunidad 1. |
| R-P2 | `reprobo_primer_intento` = al menos una evaluación de ese primer intento es `NO APROBADO`. |
| R-P3 | La variante estricta ("todas reprobadas") queda como parámetro de la consulta 16. |
| R-P4 | Si en el primer intento hay más de una carrera, la postulación cuenta una vez por cada una (R-C8). Las de `carrera = null` no entran en el ranking. |

Cifras (56,337 postulaciones): el primer intento ocurre en la oportunidad 1 en 33,730, en la 2 en 9,692, en la 3
en 6,403, en la 4 en 6,324 y en la 5 en 188. Reprobaron al menos una materia 54,542 (96.8 %); reprobaron todas
44,743; 9,799 aprobaron una y reprobaron otra; 1,795 aprobaron todo. Hay 1,037 postulaciones con más de una carrera
en su primer intento y 6,148 con carrera `null` (todas de 2015).

---

## 12. Unidad de conteo y nivel por consulta (propuesta, por confirmar)

- **Persona:** `aspirante_id` distinto. Se usa cuando no hay dimensión de año y el atributo es estable.
- **Postulación:** aspirante + año de ingreso. Se usa cuando interviene carrera, edad, aprobación o año.

| Consulta | Nivel de aprobación | Unidad |
|---|---|---|
| 1 Aspirantes por tipo de institución | — | Persona |
| 2 Aprobados por materia | Evaluación | Evaluación |
| 3 Aprobados por carrera y año de ingreso | (c) | Postulación |
| 4 % de aprobación por materia | Evaluación (informativo: aspirante-materia-año) | Evaluación |
| 5 Edad promedio por carrera | — | Postulación con edad válida |
| 6 Colección `resumen_carrera` | (c) y (a) | Postulación |
| 7 Edad promedio de aprobados por carrera y tipo de institución | (c) | Postulación |
| 8 Aprobados por municipio y carrera | (c) | Postulación |
| 9 Evaluaciones por mes y materia (instituciones públicas) | — | Evaluación |
| 10 Top 5 carreras entre 16 y 18 años | — | Postulación |
| 11 y 15 Historial de un aspirante | — | Persona |
| 12 Distribución por sexo y tipo de institución | — | Persona |
| 13 Tasa de aprobación por edad | (c) | Postulación con edad válida |
| 14 Promedio de intentos por materia | Nivel 2 | Aspirante-materia-año |
| 16 Carreras con más reprobados en primer intento | R-P1 a R-P4 | Postulación |
| 17 Top 5 municipios con más aspirantes | — | Persona |
| 18 Tasa de aprobación por tipo de institución | (c) | Postulación |
| 19 Carreras más demandadas por departamento | — | Postulación |
| 20 Evolución de aprobación por año de ingreso | Evaluación | Evaluación |

Las consultas que agrupan por carrera excluyen `carrera = null`. Las que agrupan por geografía o tipo de
institución excluyen los valores `null`.

---

## 13. Limitaciones

1. **2015 no tiene años anteriores.** 1,429 postulaciones (23.2 % de 2015) presentan una sola materia y no se puede verificar si aprobaron la otra antes. Para 2015 los indicadores (a) y (c) coinciden por construcción. Además, 2015 casi no tiene información de carrera.
2. **Sin registro previo en 2016–2024:** 850 postulaciones con una sola materia no tienen registro previo de la otra (aprobación anterior a 2015, exoneración o cambio de ID).
3. **Aprobaciones arrastradas de más de 2 años:** 1,720 de 8,354 (20.6 %) superan los 2 años respecto a la última evaluación del año. Los datos no explican por qué; su efecto en el indicador (c) es de solo 188 postulaciones.
4. **Una aprobación histórica no demuestra por sí sola que siguiera vigente administrativamente.** El dataset no trae fechas de inscripción ni de publicación de resultados.
5. **Truncados de 2022–2024:** la zona de la capital se pierde (25,579 filas) y `INGENIERIA MECANICA ` es ambigua (3,789 filas).
6. **No se puede detectar** a una misma persona con dos correlativos, ni confirmar la reutilización de códigos.
7. **Alcance de la vigencia por materia:** la constancia es de SUN-CUNOC, no de la Facultad de Ingeniería central, aunque ambas rigen bajo el mismo reglamento.

---

## 14. Supuestos adoptados

1. Los primeros 20 caracteres del correlativo identifican a la misma persona (§5).
2. La vigencia del artículo 43 aplica por materia, desde la fecha de la prueba, por 2 años calendario (§10.2).
3. `fecha_asignacion` equivale a la fecha de la prueba. Coincide en Matemática y Computación de una misma oportunidad en el 97.1 % de los casos (77,771 de 80,066).
4. Matemática y Computación son las dos materias requeridas.
5. Una aprobación nunca se revierte por un resultado posterior (R-D3).
6. Para 2015, una materia sin registro previo es información desconocida, no reprobada.
7. En 2022–2024, `INGENIERIA MECANICA` (sin espacio) corresponde a Mecánica propiamente dicha (§6).

---

## 15. Evidencia y reproducibilidad

- **Reglamento SUN:** artículo 43 y artículo 39 (cada unidad aplica una y máximo dos pruebas específicas). Se consultó la copia publicada por la USAC (vigente desde el 5 de junio de 2009) y una versión con notas de aprobación pendiente (aportada por el autor); el artículo 43 es idéntico en ambas. No se encontró un acta que lo reforme, pero tampoco se pudo obtener un texto consolidado vigente.
- **Cifras de este documento:** se obtuvieron con scripts de perfilado ad hoc sobre los 10 CSV (no incluidos en el repositorio). Las consultas equivalentes se documentarán en `consultas-mongodb.md`, y las cifras de carga deberán coincidir con las del reporte de ETL.
