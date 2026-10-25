import cors from 'cors';
import express from 'express';
import { mongoDisponible } from './config/mongo';
import { neo4jDisponible } from './config/neo4j';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { etlRoutes } from './modules/etl/etl.routes';
import { graphRoutes } from './modules/graph/graph.routes';
import { asyncHandler, manejarErrores } from './shared/middlewares/errorHandler';

export function crearApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Estado de las dos bases de datos: sirve para que la interfaz muestre errores de conexión claros
  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      const [mongo, neo4j] = await Promise.all([mongoDisponible(), neo4jDisponible()]);
      res.status(mongo && neo4j ? 200 : 503).json({ mongo, neo4j });
    }),
  );

  app.use('/api/etl', etlRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/graph', graphRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada.' } });
  });
  app.use(manejarErrores);
  return app;
}
