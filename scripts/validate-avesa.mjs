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

const conceptoIndex = output.headers.indexOf('Concepto');
const valorIndex = output.headers.indexOf('Valor');
const origenIndex = output.headers.indexOf('Origen');
const objetoIndex = output.headers.indexOf('Objeto');
const periodoIndex = output.headers.indexOf('Periodo de pago');
const accionIndex = output.headers.indexOf('Acción');
const consolidableIndex = output.headers.indexOf('Consolidable');
const araya = output.rows.find((row) => row[0] === '11398527-5' && row[conceptoIndex] === 'minatrasos');
const armijo = output.rows.find((row) => row[0] === '11142274-5' && row[conceptoIndex] === 'minatrasos');
const horaExtra = output.rows.find((row) => row[conceptoIndex] === 'horasEx50');

if (!araya || araya[valorIndex] !== 150) {
  throw new Error(`Spot check ARAYA falló: ${araya?.[valorIndex]}`);
}

if (!armijo || armijo[valorIndex] !== 199.8) {
  throw new Error(`Spot check ARMIJO falló: ${armijo?.[valorIndex]}`);
}

if (output.rows.length !== output.valueCount || output.rows.length !== 182) {
  throw new Error(`Spot check detalle falló: filas ${output.rows.length}, valores ${output.valueCount}.`);
}

if (output.rows.some((row) => row[valorIndex] === null)) {
  throw new Error('Spot check filas detalle falló: hay filas sin valor.');
}

if (output.rows.some((row) => row[origenIndex] !== 'F' || row[periodoIndex] !== 'M' || row[accionIndex] !== 'M' || row[consolidableIndex] !== 'No')) {
  throw new Error('Spot check constantes falló: Origen, Periodo, Acción o Consolidable no cumplen.');
}

if (!horaExtra || horaExtra[objetoIndex] !== 'horaExtra') {
  throw new Error(`Spot check Objeto falló para horas extra: ${horaExtra?.[objetoIndex]}`);
}

console.log(JSON.stringify({
  filasDetalle: output.rowCount,
  colaboradores: output.collaboratorCount,
  conceptosActivos: output.conceptCount,
  valores: output.valueCount,
  pendientesConValores: analysis.pendingColumns.map((item) => item.columnName),
  arayaMinatrasos: araya[valorIndex],
  armijoMinatrasos: armijo[valorIndex],
  horaExtraObjeto: horaExtra[objetoIndex],
  origen: 'F',
  accion: 'M',
  consolidable: 'No',
}, null, 2));
