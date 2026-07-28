# Deploy Swat Pooler Haberes

## GitHub Pages bajo `ispipipi`

La app está configurada con:

```js
base: '/swat-pooler-haberes/'
```

Build:

```bash
npm install
npm run build
```

Publicar `dist/` en GitHub Pages dentro del repo/proyecto `swat-pooler-haberes`.

## Firebase

Variables requeridas:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_AUTH_DOMAIN=
```

Servicios requeridos:

- Firebase Auth con Email/password habilitado.
- Firestore con escritura permitida a usuarios internos autenticados según reglas del proyecto.

## Semilla inicial

Dentro de la app, usar el botón `Sembrar base` para crear:

- `grupos`: Grupo AVESA, Grupo CRUX, SSCSPACE.
- `catalogoConceptos`: conceptos mínimos para operar AVESA.
- `mapeos/grupo_avesa/conceptos`: 20 mapeos confirmados conocidos.

El catálogo completo se importa desde la pantalla Mantenedor usando el Excel `Lista de conceptos`.
