import { Router } from 'express';
import { asyncHandler } from '../../shared/middlewares/errorHandler';
import { ejecutar, listar } from './analytics.controller';

export const analyticsRoutes = Router();

analyticsRoutes.get('/consultas', listar);
analyticsRoutes.get('/consultas/:id', asyncHandler(ejecutar));
