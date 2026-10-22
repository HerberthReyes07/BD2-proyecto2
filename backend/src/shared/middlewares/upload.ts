import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import multer from 'multer';
import { AppError } from '../errors/AppError';

const carpeta = path.join(os.tmpdir(), 'admision-uploads');
fs.mkdirSync(carpeta, { recursive: true });

/** Recibe archivos CSV (hasta 100 MB cada uno) y los deja en una carpeta temporal. */
export const subirCsv = multer({
  dest: carpeta,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, archivo, cb) => {
    if (path.extname(archivo.originalname).toLowerCase() !== '.csv') {
      cb(new AppError(400, 'ARCHIVO_NO_CSV', `"${archivo.originalname}" no es un archivo .csv`));
      return;
    }
    cb(null, true);
  },
});
