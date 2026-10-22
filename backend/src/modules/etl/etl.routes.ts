import { Router } from 'express';
import { asyncHandler } from '../../shared/middlewares/errorHandler';
import { subirCsv } from '../../shared/middlewares/upload';
import { crearCargas, listarCargas, listarRechazados, reconstruir } from './etl.controller';

export const etlRoutes = Router();

etlRoutes.post('/cargas', subirCsv.array('archivos', 20), asyncHandler(crearCargas));
etlRoutes.get('/cargas', asyncHandler(listarCargas));
etlRoutes.get('/cargas/:id/rechazados', asyncHandler(listarRechazados));
etlRoutes.post('/reconstruir', asyncHandler(reconstruir));
