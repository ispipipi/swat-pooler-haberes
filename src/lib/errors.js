export const ERRORS = {
  firebaseMissing:
    'Firebase no está conectado todavía. Configura VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID y VITE_FIREBASE_AUTH_DOMAIN para activar Auth y Firestore compartido.',
  baseSheetMissing:
    'No encontramos la hoja Base en este Pooler. Revisa que el archivo corresponda al formato Swat del grupo seleccionado.',
  poolerHeaderMissing:
    'No pudimos ubicar la fila de encabezados del Pooler. La fila debe contener al menos Rut y Ctto.',
  atrasosMissing:
    'La columna Atrasos no existe en la hoja Base. Sin ese punto de partida no podemos detectar conceptos variables.',
  requiredColumnMissing: (name) =>
    `Falta la columna requerida "${name}" en la hoja Base. El archivo no está listo para el flujo Swat.`,
  disabledConcept: (code) =>
    `El concepto "${code}" no está habilitado en el catálogo maestro. Habilítalo o elige otro código antes de guardar.`,
  unknownConcept: (code) =>
    `El código "${code}" no existe en el catálogo maestro. Importa el catálogo o corrige el código antes de confirmar.`,
  pendingMappings:
    'Hay columnas sin mapeo confirmado. Resuélvelas en el mantenedor antes de generar la vista previa.',
  noOutputRows:
    'El Pooler no tiene colaboradores con RUT válido para transformar.',
  noActiveConcepts:
    'No hay conceptos confirmados con valores informados. Revisa el mapeo y las columnas del Pooler.',
  catalogColumnsMissing:
    'El catálogo no trae las columnas mínimas Concepto y Nombre. Revisa que sea el archivo Lista de conceptos.',
};
