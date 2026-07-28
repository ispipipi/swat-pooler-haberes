export function cleanText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function normalizeKey(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function cleanRut(value) {
  return cleanText(value).replace(/\./g, '').toUpperCase();
}

export function formatNumberForUi(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}
