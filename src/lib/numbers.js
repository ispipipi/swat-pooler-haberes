export function parseLocaleNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;

  let text = String(value).trim();
  if (!text) return null;

  text = text.replace(/\s/g, '').replace(/\$/g, '').replace(/[^\d,.-]/g, '');
  if (!text || text === '-' || text === ',' || text === '.') return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    const decimalSeparator = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    text = text.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  } else if (hasComma) {
    text = normalizeSingleSeparator(text, ',');
  } else if (hasDot) {
    text = normalizeSingleSeparator(text, '.');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSingleSeparator(text, separator) {
  const parts = text.split(separator);
  if (parts.length > 2) return parts.join('');

  const [left, right = ''] = parts;
  if (right.length === 3 && left.length > 1) return `${left}${right}`;
  return `${left}.${right}`;
}

export function applyNumberRule(value, multiplicador = 1, redondeo = 'ninguno') {
  const number = parseLocaleNumber(value);
  if (number === null) return null;

  const multiplied = number * (parseLocaleNumber(multiplicador) ?? 1);
  if (redondeo === 'entero') return Math.round(multiplied);
  if (redondeo === 'decimal') return roundNumber(multiplied, 2);
  return cleanFloatingNoise(multiplied);
}

function roundNumber(value, decimals) {
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function cleanFloatingNoise(value) {
  const rounded = roundNumber(value, 10);
  return Object.is(rounded, -0) ? 0 : rounded;
}
