export const GROUPS = [
  { id: 'grupo_avesa', nombre: 'Grupo AVESA', activo: true },
  { id: 'grupo_crux', nombre: 'Grupo CRUX', activo: true },
  { id: 'sscspace', nombre: 'SSCSPACE', activo: true },
];

export const AVESA_MAPPINGS = [
  { columnaPooler: 'Atrasos', codigoConcepto: 'minatrasos', multiplicador: 60, redondeo: 'decimal' },
  { columnaPooler: 'Cantidad Horas Extras', codigoConcepto: 'horasEx50', multiplicador: 1, redondeo: 'decimal' },
  { columnaPooler: 'Bono Responsabilidad', codigoConcepto: 'bonoresp', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Bono Asistencia', codigoConcepto: 'bonoasist', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Comision', codigoConcepto: 'comision', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Bono Inventario', codigoConcepto: 'bonoinventario', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Bono turno agrosuper', codigoConcepto: 'bonturnagro', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Colación', codigoConcepto: 'colacion', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Bono Especial', codigoConcepto: 'bonoespecial', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Bono Cumplimiento', codigoConcepto: 'bonocumplimiento', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Bono Variable', codigoConcepto: 'bonovariable', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Bono Producción', codigoConcepto: 'bonoprod', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Asignación Sala Cuna', codigoConcepto: 'salacuna', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Anticipo', codigoConcepto: 'anticipo', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'COLECTA', codigoConcepto: 'colecta', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Prestamo Medico Fonasa', codigoConcepto: 'prestmedicofonasa', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Compras', codigoConcepto: 'compras', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Descuento por atraso', codigoConcepto: 'atraso', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Convenio FALP', codigoConcepto: 'falp', multiplicador: 1, redondeo: 'ninguno' },
  { columnaPooler: 'Préstamo empresa', codigoConcepto: 'prestamoempresa', multiplicador: 1, redondeo: 'ninguno' },
];

export const SEED_CATALOG = [
  { codigo: 'minatrasos', nombre: 'Minutos de Atrasos', tipo: 'Haber afecto Especial', habilitado: true },
  { codigo: 'horasEx50', nombre: 'Horas Extras 50%', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'hheee50', nombre: 'Horas Extras Empresa 50%', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'bonoresp', nombre: 'Bono Responsabilidad', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'bonoasist', nombre: 'Bono Asistencia', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'comision', nombre: 'Comision', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'bonoinventario', nombre: 'Bono Inventario', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'bonturnagro', nombre: 'Bono turno agrosuper', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'colacion', nombre: 'Colacion', tipo: 'Haber exento', habilitado: true },
  { codigo: 'bonoespecial', nombre: 'Bono Especial', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'bonocumplimiento', nombre: 'Bono Cumplimiento', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'bonovariable', nombre: 'Bono Variable', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'bonoprod', nombre: 'Bono Producción', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'salacuna', nombre: 'Asignación Sala Cuna', tipo: 'Haber exento', habilitado: true },
  { codigo: 'AsignacionSalaCuna', nombre: 'Asignación Sala Cuna NP', tipo: 'Haber exento', habilitado: true },
  { codigo: 'anticipo', nombre: 'Anticipo', tipo: 'Descuento', habilitado: true },
  { codigo: 'colecta', nombre: 'Descuento Colecta', tipo: 'Descuento', habilitado: true },
  { codigo: 'prestmedicofonasa', nombre: 'Préstamo Medico Fonasa', tipo: 'Descuento', habilitado: true },
  { codigo: 'compras', nombre: 'Compras', tipo: 'Descuento', habilitado: true },
  { codigo: 'atraso', nombre: 'Descuento por atraso o salida', tipo: 'Descuento', habilitado: true },
  { codigo: 'falp', nombre: 'Convenio FALP', tipo: 'Descuento', habilitado: true },
  { codigo: 'prestamoempresa', nombre: 'Préstamo empresa', tipo: 'Descuento', habilitado: true },
  { codigo: 'otrosHaberes', nombre: 'Otros Haberes', tipo: 'Haber afecto', habilitado: true },
  { codigo: 'descuentosVarios', nombre: 'Descuentos Varios', tipo: 'Descuento', habilitado: true },
];

export const REDONDEO_OPTIONS = ['ninguno', 'decimal', 'entero'];

export const OUTPUT_BASE_HEADERS = ['Plantilla', 'Nombre colaborador', 'Contrato', 'Nombre de contrato', 'Accion'];
