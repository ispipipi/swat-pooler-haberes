import * as XLSX from 'xlsx';
import FileSaver from 'file-saver';
import { FUNCTION_CATALOG, OUTPUT_DETAIL_HEADERS } from '../data/seeds.js';
import { ERRORS } from './errors.js';
import { applyNumberRule, parseLocaleNumber } from './numbers.js';
import { cleanRut, cleanText, normalizeKey } from './text.js';

const { saveAs } = FileSaver;

export async function readWorkbook(file) {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellStyles: true,
    raw: true,
  });
}

export async function readCatalogExcel(file) {
  const workbook = await readWorkbook(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = rows.findIndex((row) => {
    const keys = row.map((cell) => normalizeKey(cell));
    return keys.includes('concepto') && keys.includes('nombre');
  });

  if (headerIndex < 0) {
    throw new Error(ERRORS.catalogColumnsMissing);
  }

  const headers = rows[headerIndex].map((cell) => normalizeKey(cell));
  const conceptoIndex = headers.indexOf('concepto');
  const nombreIndex = headers.indexOf('nombre');
  const tipoIndex = headers.indexOf('tipo');
  const habilitadoIndex = headers.indexOf('habilitado');

  const concepts = rows
    .slice(headerIndex + 1)
    .map((row) => {
      const codigo = cleanText(row[conceptoIndex]);
      const nombre = cleanText(row[nombreIndex]);
      if (!codigo || !nombre) return null;
      return {
        codigo,
        nombre,
        tipo: cleanText(row[tipoIndex]) || 'Dato',
        habilitado: normalizeKey(row[habilitadoIndex] ?? 'si') !== 'no',
      };
    })
    .filter(Boolean);

  return concepts;
}

export async function readPooler(file) {
  const workbook = await readWorkbook(file);
  const sheet = workbook.Sheets.Base || workbook.Sheets.BASE;
  if (!sheet) {
    throw new Error(ERRORS.baseSheetMissing);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerRowIndex = rows.findIndex((row) => normalizeKey(row[0]) === 'rut' && normalizeKey(row[1]) === 'ctto');
  if (headerRowIndex < 0) {
    throw new Error(ERRORS.poolerHeaderMissing);
  }

  const headers = rows[headerRowIndex].map((cell) => cleanText(cell));
  const headerIndexes = mapHeaderIndexes(headers);
  const startIndex = headers.findIndex((header) => normalizeKey(header) === 'atrasos');
  if (startIndex < 0) {
    throw new Error(ERRORS.atrasosMissing);
  }

  const conceptColumns = headers
    .slice(startIndex)
    .filter((header) => header && normalizeKey(header) !== 'observaciones');

  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => cleanRut(row[headerIndexes.Rut]));

  return {
    fileName: file.name,
    headers,
    headerIndexes,
    conceptColumns,
    dataRows,
  };
}

function mapHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    if (header) indexes[header] = index;
  });

  ['Rut', 'Ctto', 'Nombre'].forEach((name) => {
    if (!(name in indexes)) {
      throw new Error(ERRORS.requiredColumnMissing(name));
    }
  });

  return indexes;
}

export function analyzePooler(pooler, mappings, catalog) {
  const mappingsByColumn = new Map(mappings.map((item) => [normalizeKey(item.columnaPooler), item]));
  const catalogByCode = new Map(catalog.map((item) => [normalizeKey(item.codigo), item]));

  const columns = pooler.conceptColumns.map((columnName, order) => {
    const mapping = mappingsByColumn.get(normalizeKey(columnName));
    const catalogEntry = mapping ? catalogByCode.get(normalizeKey(mapping.codigoConcepto)) : null;
    const index = pooler.headerIndexes[columnName];
    const parsedValues = pooler.dataRows
      .map((row) => parseLocaleNumber(row[index]))
      .filter((value) => value !== null);
    const confirmed = Boolean(mapping && catalogEntry && catalogEntry.habilitado === true);
    const transformedValues = confirmed
      ? pooler.dataRows
          .map((row) => applyNumberRule(row[index], mapping.multiplicador ?? 1, mapping.redondeo ?? 'ninguno'))
          .filter((value) => value !== null)
      : parsedValues;
    const hasValues = parsedValues.length > 0;
    const valueCount = transformedValues.length;
    const total = transformedValues.reduce((sum, value) => sum + value, 0);

    if (!mapping) {
      return {
        order,
        columnName,
        status: 'sin_mapear',
        hasValues,
        valueCount,
        total,
        mapping: null,
        catalogEntry: null,
      };
    }

    if (!catalogEntry || catalogEntry.habilitado !== true) {
      return {
        order,
        columnName,
        status: 'sin_mapear',
        hasValues,
        valueCount,
        total,
        mapping,
        catalogEntry,
      };
    }

    return {
      order,
      columnName,
      status: 'confirmado',
      hasValues,
      valueCount,
      total,
      mapping,
      catalogEntry,
    };
  });

  const pendingColumns = columns.filter((item) => item.status !== 'confirmado' && item.hasValues);
  const activeColumns = columns.filter((item) => item.status === 'confirmado' && item.hasValues);
  const output = pendingColumns.length === 0 ? buildOutput(pooler, activeColumns) : null;

  return {
    columns,
    pendingColumns,
    activeColumns,
    output,
  };
}

export function buildOutput(pooler, activeColumns) {
  const headers = OUTPUT_DETAIL_HEADERS;
  const rows = [];
  const functionIds = new Set(FUNCTION_CATALOG.map((item) => normalizeKey(item.id)));

  pooler.dataRows.forEach((row) => {
    const rut = cleanRut(row[pooler.headerIndexes.Rut]);
    const contrato = parseLocaleNumber(row[pooler.headerIndexes.Ctto]);
    const contratoValue = contrato ?? cleanText(row[pooler.headerIndexes.Ctto]);
    const nombre = cleanText(row[pooler.headerIndexes.Nombre]);
    const nombreContrato = contratoValue ? `Contrato ${contratoValue}` : '';

    activeColumns.forEach((column) => {
      const index = pooler.headerIndexes[column.columnName];
      const valor = applyNumberRule(row[index], column.mapping.multiplicador ?? 1, column.mapping.redondeo ?? 'ninguno');
      if (valor === null) return;

      const codigoConcepto = cleanText(column.mapping.codigoConcepto);
      const objetoFuncion = cleanText(column.mapping.objetoFuncion)
        || (functionIds.has(normalizeKey(codigoConcepto)) ? codigoConcepto : '');

      rows.push([
        rut,
        nombre,
        contratoValue,
        nombreContrato,
        codigoConcepto,
        valor,
        'F',
        objetoFuncion,
        'M',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'M',
        'No',
      ]);
    });
  });

  if (rows.length === 0) {
    throw new Error(ERRORS.noOutputRows);
  }

  if (activeColumns.length === 0) {
    throw new Error(ERRORS.noActiveConcepts);
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
    conceptCount: activeColumns.length,
    valueCount: rows.length,
    collaboratorCount: new Set(rows.map((row) => row[0])).size,
  };
}

export function downloadOutputWorkbook(output, sourceName = 'pooler') {
  const csv = toSemicolonCsv([output.headers, ...output.rows]);
  const safeName = sourceName.replace(/\.[^.]+$/, '').replace(/[^\w\d-]+/g, '_').replace(/^_+|_+$/g, '');
  saveAs(
    new Blob([encodeWindows1252(csv)], { type: 'text/csv;charset=windows-1252' }),
    `${safeName || 'pooler'}_carga_masiva_haberes_detalle_swat.csv`,
  );
}

function toSemicolonCsv(rows) {
  return `${rows.map((row) => row.map(formatCsvCell).join(';')).join('\r\n')}\r\n`;
}

function formatCsvCell(value) {
  if (typeof value === 'number') {
    return formatCsvNumber(value);
  }

  const text = cleanText(value);
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCsvNumber(value) {
  if (!Number.isFinite(value)) return '';
  return String(value).replace('.', ',');
}

function encodeWindows1252(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[index] = code <= 255 ? code : 63;
  }
  return bytes;
}
