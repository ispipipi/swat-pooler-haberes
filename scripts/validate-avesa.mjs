import fs from 'node:fs/promises';
import { analyzePooler, readCatalogExcel, readPooler } from '../src/lib/excel.js';
import { AVESA_MAPPINGS, SEED_CATALOG } from '../src/data/seeds.js';

function asFile(path, name) {
  return {
    name,
    async arrayBuffer() {
      const buffer = await fs.readFile(path);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },
  };
}

const poolerFile = asFile('/Users/julioespinoza/Downloads/Pooler - AVESA Julio 2026.xlsx', 'Pooler - AVESA Julio 2026.xlsx');
const catalogFile = asFile('/Users/julioespinoza/Downloads/Lista de conceptos (4).xlsx', 'Lista de conceptos (4).xlsx');

const pooler = await readPooler(poolerFile);
const importedCatalog = await readCatalogExcel(catalogFile);
const catalogByCode = new Map([...SEED_CATALOG, ...importedCatalog].map((concept) => [concept.codigo, concept]));
const catalog = Array.from(catalogByCode.values());
const analysis = analyzePooler(pooler, AVESA_MAPPINGS, catalog);

if (analysis.pendingColumns.some((item) => item.columnName !== 'Otros')) {
  throw new Error(`Hay columnas pendientes inesperadas: ${analysis.pendingColumns.map((item) => item.columnName).join(', ')}`);
}

const output = analysis.output;
if (!output) {
  throw new Error('No se generó output porque hay pendientes con valores.');
}

const araya = output.rows.find((row) => row[0] === '11398527-5');
const armijo = output.rows.find((row) => row[0] === '11142274-5');
const minatrasosIndex = output.headers.indexOf('minatrasos');
const accionIndex = output.headers.indexOf('Accion');

if (!araya || araya[minatrasosIndex] !== 150) {
  throw new Error(`Spot check ARAYA falló: ${araya?.[minatrasosIndex]}`);
}

if (!armijo || armijo[minatrasosIndex] !== 199.8) {
  throw new Error(`Spot check ARMIJO falló: ${armijo?.[minatrasosIndex]}`);
}

if (output.rows.some((row) => row[accionIndex] !== 'C')) {
  throw new Error('Spot check Acción falló: hay filas sin C.');
}

if (output.rows.some((row) => row.slice(accionIndex + 1).every((value) => value === null))) {
  throw new Error('Spot check filas exportables falló: hay colaboradores sin conceptos informados.');
}

console.log(JSON.stringify({
  colaboradores: output.rowCount,
  conceptosActivos: output.conceptCount,
  valores: output.valueCount,
  pendientesConValores: analysis.pendingColumns.map((item) => item.columnName),
  arayaMinatrasos: araya[minatrasosIndex],
  armijoMinatrasos: armijo[minatrasosIndex],
  accion: 'C',
}, null, 2));
