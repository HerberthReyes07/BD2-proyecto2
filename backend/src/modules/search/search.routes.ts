import { Router } from 'express';
import { asyncHandler } from '../../shared/middlewares/errorHandler';
import { buscar, catalogos } from './search.controller';

export const searchRoutes = Router();

searchRoutes.get('/postulaciones', asyncHandler(buscar));
searchRoutes.get('/catalogos', asyncHandler(catalogos));
