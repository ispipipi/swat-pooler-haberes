import * as XLSX from 'xlsx';
import FileSaver from 'file-saver';
import { OUTPUT_BASE_HEADERS } from '../data/seeds.js';
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
  const headers = [...OUTPUT_BASE_HEADERS, ...activeColumns.map((item) => item.mapping.codigoConcepto)];

  const rows = pooler.dataRows.map((row) => {
    const rut = cleanRut(row[pooler.headerIndexes.Rut]);
    const contrato = parseLocaleNumber(row[pooler.headerIndexes.Ctto]);
    const contratoValue = contrato ?? cleanText(row[pooler.headerIndexes.Ctto]);
    const nombre = cleanText(row[pooler.headerIndexes.Nombre]);
    const base = [rut, nombre, contratoValue, contratoValue ? `Contrato ${contratoValue}` : '', 'C'];
    const conceptValues = activeColumns.map((column) => {
      const index = pooler.headerIndexes[column.columnName];
      return applyNumberRule(row[index], column.mapping.multiplicador ?? 1, column.mapping.redondeo ?? 'ninguno');
    });
    return [...base, ...conceptValues];
  }).filter((row) => row.slice(OUTPUT_BASE_HEADERS.length).some((value) => value !== null));

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
    valueCount: rows.reduce((sum, row) => sum + row.slice(OUTPUT_BASE_HEADERS.length).filter((value) => value !== null).length, 0),
  };
}

export function downloadOutputWorkbook(output, sourceName = 'pooler') {
  const worksheet = XLSX.utils.aoa_to_sheet([output.headers, ...output.rows]);
  worksheet['!cols'] = output.headers.map((header, index) => ({
    wch: index < 5 ? [16, 34, 10, 22, 10][index] : Math.max(12, String(header).length + 2),
  }));

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
    const rutAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 0 });
    if (worksheet[rutAddress]) {
      worksheet[rutAddress].t = 's';
      worksheet[rutAddress].z = '@';
    }

    for (let colIndex = 2; colIndex <= range.e.c; colIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[cellAddress];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = 'General';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Conceptos masivo');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const safeName = sourceName.replace(/\.[^.]+$/, '').replace(/[^\w\d-]+/g, '_').replace(/^_+|_+$/g, '');
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeName || 'pooler'}_carga_masiva_haberes_swat.xlsx`,
  );
}
