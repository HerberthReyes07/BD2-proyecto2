/**
 * Genera src/modules/etl/catalogos/municipios.json: el catálogo de municipios COMPLETOS por departamento,
 * tomado de los archivos 2015-2021 (los 2022-2024 traen los nombres truncados). Se usa en la regla R-G5
 * para completar municipios truncados. Se ejecuta una sola vez; el resultado se versiona en el repositorio.
 *
 * Uso: npm run catalogo -- [carpeta_de_csv]   (por defecto ../data)
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { leerFilas } from '../src/modules/etl/pipeline/reader';
import { normalizarTexto } from '../src/modules/etl/pipeline/texto';

async function main() {
  const carpeta = path.resolve(process.argv[2] ?? path.join(__dirname, '../../data'));
  const archivos = readdirSync(carpeta)
    .filter((f) => /^pruebas_especificas_(\d{4})\.csv$/.test(f))
    .filter((f) => Number(/(\d{4})/.exec(f)![1]) <= 2021)
    .sort();

  const catalogo = new Map<string, Set<string>>();
  for (const archivo of archivos) {
    for await (const item of leerFilas(path.join(carpeta, archivo))) {
      if (item.tipo !== 'fila') continue;
      const dep = normalizarTexto(item.valores.departamento_institucion_educativa);
      let mun = normalizarTexto(item.valores.municipio_institucion_educativa);
      if (dep === 'SIN DATOS' || mun === 'SIN DATOS') continue;
      if (mun.startsWith('GUATEMALA - CIUDAD')) mun = 'GUATEMALA'; // las zonas de la capital se tratan aparte (R-G4)
      if (!catalogo.has(dep)) catalogo.set(dep, new Set());
      catalogo.get(dep)!.add(mun);
    }
  }

  const salida: Record<string, string[]> = {};
  for (const dep of [...catalogo.keys()].sort()) salida[dep] = [...catalogo.get(dep)!].sort();

  const destino = path.join(__dirname, '../src/modules/etl/catalogos/municipios.json');
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(salida, null, 2) + '\n', 'utf-8');
  const total = Object.values(salida).reduce((n, v) => n + v.length, 0);
  console.log(`Catálogo generado: ${Object.keys(salida).length} departamentos, ${total} municipios -> ${destino}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
