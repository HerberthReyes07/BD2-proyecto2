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
- Los 10 archivos `pruebas_especificas_AAAA.csv` copiados en `data/`

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

## Comandos del backend

| Comando | Qué hace |
|---|---|
| `npm start` | Inicia la API (`GET /api/health` informa el estado de las dos bases de datos) |
| `npm run load -- [archivos]` | Carga por línea de comandos los CSV indicados (sin argumentos, todos los de `data/`) |
| `npm run reconstruir` | Recalcula las colecciones derivadas y sincroniza Neo4j sin leer los CSV |
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

Resultado esperado de cargar los 10 archivos: 208,453 filas leídas, 207,606 cargadas, 847 rechazadas
(todas por duplicado), 40,197 aspirantes, 56,337 postulaciones y 8,471 aprobados. En Neo4j, 96,831 nodos y
430,700 relaciones. Detalles en [docs/reglas-etl.md](docs/reglas-etl.md).

## Documentación

- [Reglas de ETL](docs/reglas-etl.md)
- [Modelo de MongoDB](docs/modelo-mongodb.md)
- [Modelo de Neo4j](docs/modelo-neo4j.md)
