import { Router } from 'express';
import { asyncHandler } from '../../shared/middlewares/errorHandler';
import { ejecutar, listar, obtenerCatalogos, obtenerMapaDemanda, obtenerRedAspirante, obtenerResumen } from './graph.controller';

export const graphRoutes = Router();

graphRoutes.get('/consultas', listar);
graphRoutes.get('/consultas/:id', asyncHandler(ejecutar));
graphRoutes.get('/catalogos', asyncHandler(obtenerCatalogos));
graphRoutes.get('/resumen', asyncHandler(obtenerResumen));
graphRoutes.get('/mapa-demanda', asyncHandler(obtenerMapaDemanda));
graphRoutes.get('/aspirante/:id', asyncHandler(obtenerRedAspirante));
