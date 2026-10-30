# Proyecto Final – Bases de Datos 2

Aplicación para cargar, analizar y visualizar las pruebas específicas de aspirantes
(Facultad de Ingeniería, USAC) usando **MongoDB** (análisis estadístico) y **Neo4j** (relaciones).

## Estructura

| Carpeta | Contenido |
|---|---|
| `backend/` | API (Node.js + TypeScript): ETL, consultas MongoDB, consultas Neo4j, búsqueda |
| `frontend/` | Interfaz (React + Vite): carga de CSV, dashboard, explorador de grafos, buscador |
| `data/` | CSV de origen (no se versionan) |
| `docs/` | Manuales, modelos, reglas de ETL, consultas, análisis y conclusiones |

## Requisitos

- Node.js 20 o superior
- Docker y Docker Compose
- Los 10 archivos `pruebas_especificas_AAAA.csv` (2015 a 2024) copiados en `data/`. Se descargan del portal de [Datos Abiertos de la Facultad de Ingeniería – Pruebas específicas](https://datosabiertos.ingenieria.usac.edu.gt/dataset/pruebas-especificas); los CSV no se versionan en el repositorio

## Puesta en marcha

```bash
# 1. Variables de entorno: copiar la plantilla y poner una contraseña propia para Neo4j
cp .env.example .env

# 2. Bases de datos (MongoDB y Neo4j)
docker compose up -d mongo neo4j

# 3. Dependencias del backend
cd backend && npm install

# 4. Cargar los CSV (ETL): MongoDB, colecciones derivadas y Neo4j  (≈ 1 minuto)
npm run load

# 5. Iniciar la API en http://localhost:3000
npm start
```

En otra terminal, la interfaz:

```bash
# 6. Interfaz web en http://localhost:5173 (el servidor de desarrollo reenvía /api al backend)
cd frontend && npm install && npm run dev
```

La interfaz tiene cuatro secciones: **Dashboard** (las 20 consultas de MongoDB con gráficas y tablas), **Grafos** (mapa de
demanda, red de un aspirante y consultas Cypher), **Buscador** (filtros por aspirante, carrera, institución, materia, municipio y
departamento) y **Carga de archivos** (subida de CSV con reporte y filas rechazadas). El navegador solo habla con el backend:
nunca se conecta directamente a MongoDB ni a Neo4j.

## Comandos del backend

| Comando | Qué hace |
|---|---|
| `npm start` | Inicia la API (`GET /api/health` informa el estado de las dos bases de datos) |
| `npm run load -- [archivos]` | Carga por línea de comandos los CSV indicados (sin argumentos, todos los de `data/`) |
| `npm run reconstruir` | Recalcula las colecciones derivadas y sincroniza Neo4j sin leer los CSV |
| `npm run reiniciar -- --si` | **Borra** los datos de MongoDB y Neo4j para volver a cargar desde cero (sin `--si` no hace nada). Equivale al botón de la interfaz |
| `npm run consultas` | Ejecuta las 20 consultas de MongoDB y muestra filas y tiempos |
| `npm run doc:consultas` | Regenera `docs/consultas-mongodb.md` con los pipelines y resultados reales |
| `npm run cypher` | Ejecuta las 6 consultas Cypher y las vistas del grafo, mostrando filas y tiempos |
| `npm run doc:cypher` | Regenera `docs/consultas-cypher.md` con el Cypher y los resultados reales |
| `npm run catalogo` | Regenera el catálogo de municipios usado por la regla R-G5 |
| `npm test` | Ejecuta las pruebas unitarias |
| `npm run build` | Revisa los tipos con el compilador de TypeScript |

## API de carga

| Método y ruta | Descripción |
|---|---|
| `POST /api/etl/cargas` | Recibe uno o varios CSV (campo `archivos`, multipart) y devuelve el reporte de cada uno |
| `GET /api/etl/cargas` | Historial de cargas |
| `GET /api/etl/cargas/:id/rechazados` | Filas rechazadas de una carga (`?causa=`, `?limite=`, `?salto=`) |
| `POST /api/etl/reconstruir` | Recalcula derivadas y Neo4j |
| `DELETE /api/etl/datos?confirmar=si` | **Borra todos los datos cargados** (MongoDB y Neo4j). Sin `?confirmar=si` responde 400 y no borra nada. Es lo que hace el botón «Borrar todos los datos» de la página de carga |

Las operaciones pesadas (cargar, reconstruir y borrar) no se pueden ejecutar a la vez: si ya hay una en curso, la nueva responde 409.

## API de consultas (MongoDB)

| Método y ruta | Descripción |
|---|---|
| `GET /api/analytics/resumen` | Cifras generales (evaluaciones, aspirantes, aprobados...) |
| `GET /api/analytics/consultas` | Catálogo de las 20 consultas (título, tipo de gráfica, parámetros) |
| `GET /api/analytics/consultas/:id` | Ejecuta una consulta (`q01` a `q20`). Parámetros en la URL, por ejemplo `?anio_ingreso=2019`. Devuelve las filas y el pipeline usado |

Detalle de cada consulta, con su pipeline y resultados: [docs/consultas-mongodb.md](docs/consultas-mongodb.md).

## API de grafos (Neo4j)

| Método y ruta | Descripción |
|---|---|
| `GET /api/graph/consultas` | Catálogo de las 6 consultas Cypher (`g01` a `g06`) |
| `GET /api/graph/consultas/:id` | Ejecuta una consulta Cypher; parámetros en la URL (`?departamento=GUATEMALA&anio_ingreso=2019`) |
| `GET /api/graph/catalogos` | Departamentos, carreras, años, tipos y materias (para llenar filtros) |
| `GET /api/graph/resumen` | Cantidad de nodos y relaciones por tipo |
| `GET /api/graph/mapa-demanda` | Subgrafo Departamento–Municipio–Carrera; filtros `anio_ingreso`, `departamento`, `solo_aprobados`, `limite` |
| `GET /api/graph/aspirante/:id` | Red de un aspirante: postulaciones, carreras, lugar, institución y evaluaciones |

Detalle de las consultas Cypher: [docs/consultas-cypher.md](docs/consultas-cypher.md).

Resultado esperado de cargar los 10 archivos: 208,453 filas leídas, 207,606 cargadas, 847 rechazadas
(todas por duplicado), 40,197 aspirantes, 56,337 postulaciones y 8,471 aprobados. En Neo4j, 96,831 nodos y
430,700 relaciones. Detalles en [docs/reglas-etl.md](docs/reglas-etl.md).

## API del buscador

| Método y ruta | Descripción |
|---|---|
| `GET /api/search/postulaciones` | Busca postulaciones. Filtros opcionales: `aspirante_id` (prefijo), `carrera`, `tipo_institucion`, `materia`, `departamento`, `municipio`, `anio_ingreso`, `estado`, `edad_min`, `edad_max`; paginación con `pagina` y `por_pagina` |
| `GET /api/search/catalogos` | Valores para las listas desplegables de los filtros |

## Documentación

### Entregables

| Documento             | Contenido |
|-----------------------|---|
| [Manual técnico](docs/Manual-Técnico.pdf) | Arquitectura, instalación, ETL, modelos de MongoDB y Neo4j, API, consultas, pruebas, **análisis de resultados** (cap. 10), **conclusiones** (cap. 11) y el código de las 26 consultas (anexos A y B) |
| [Manual de usuario](docs/Manual-de-Usuario.pdf) | Cómo usar la aplicación, con capturas de pantalla |

### Documentos de apoyo

El manual técnico los resume y remite a ellos; contienen el detalle completo.

- [Reglas de ETL](docs/reglas-etl.md): cada regla de limpieza y de aprobación, con su código (R-xx) y sus cifras
- [Modelo de MongoDB](docs/modelo-mongodb.md)
- [Modelo de Neo4j](docs/modelo-neo4j.md)
- [Consultas de MongoDB](docs/consultas-mongodb.md) y [consultas de Cypher](docs/consultas-cypher.md), generadas con las consultas reales y sus resultados
