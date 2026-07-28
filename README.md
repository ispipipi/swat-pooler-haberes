# Swat Pooler Haberes v1.1.1

Aplicación React + Vite + Tailwind para convertir la hoja `Base` de un Pooler en un Excel de carga masiva de conceptos/haberes.

## Stack

- React 18
- Vite 5
- Tailwind CSS
- SheetJS
- Fuse.js
- Firebase Auth + Firestore

## Variables de entorno

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_AUTH_DOMAIN=
```

Si faltan variables, la app compila y entra en modo local de respaldo para pruebas, con un aviso visible.

## Desarrollo

```bash
npm install
npm run dev
```

## Reglas de negocio preservadas desde v1.0

- Solo se lee la hoja `Base`.
- Se detecta la fila de encabezados por `Rut` y `Ctto`.
- Los conceptos variables parten en `Atrasos`.
- RUT se exporta como texto sin puntos.
- Contrato se exporta como número.
- `Nombre de contrato` se arma como `Contrato X`.
- Los números se exportan como celdas numéricas reales en formato `General`.
- Se exportan solo conceptos confirmados con al menos un valor informado.
- `Atrasos` queda precargado con multiplicador editable `60`.

## Firestore

Estructura declarada por el MD funcional:

- `grupos`
- `catalogoConceptos`
- `mapeos/{grupoId}/conceptos`

No se persisten RUT ni montos del Pooler. El procesamiento del archivo ocurre en memoria del navegador.
