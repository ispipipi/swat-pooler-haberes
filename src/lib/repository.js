import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, firebaseReady } from './firebaseClient.js';
import { AVESA_MAPPINGS, FUNCTION_CATALOG, GROUPS, SEED_CATALOG } from '../data/seeds.js';
import { normalizeKey } from './text.js';

const STORAGE_KEY = 'swat-pooler-haberes-local-state-v111';

function createSeedState() {
  return {
    grupos: GROUPS,
    catalogoConceptos: SEED_CATALOG,
    mapeos: {
      grupo_avesa: AVESA_MAPPINGS.map((item) => ({
        ...item,
        confirmadoPor: 'seed@swat.local',
        actualizadoEn: new Date('2026-07-28T00:00:00.000Z').toISOString(),
      })),
      grupo_crux: [],
      sscspace: [],
    },
  };
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : createSeedState();
  } catch {
    return createSeedState();
  }
}

function writeLocalState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export async function loadGroups() {
  if (!firebaseReady || !db) {
    return readLocalState().grupos.filter((group) => group.activo);
  }

  const snapshot = await getDocs(collection(db, 'grupos'));
  const groups = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  return groups.filter((group) => group.activo);
}

export async function loadCatalog() {
  if (!firebaseReady || !db) {
    return readLocalState().catalogoConceptos;
  }

  const snapshot = await getDocs(collection(db, 'catalogoConceptos'));
  return snapshot.docs.map((item) => item.data());
}

export async function loadMappings(groupId) {
  if (!firebaseReady || !db) {
    return hydrateMappings(groupId, readLocalState().mapeos[groupId] ?? []);
  }

  const snapshot = await getDocs(collection(db, 'mapeos', groupId, 'conceptos'));
  return hydrateMappings(groupId, snapshot.docs.map((item) => item.data()));
}

export async function saveMapping(groupId, mapping) {
  const payload = normalizeMappingPayload(mapping);
  const userEmail = auth?.currentUser?.email ?? 'usuario.local@swat';
  const nextMapping = {
    ...payload,
    confirmadoPor: userEmail,
    actualizadoEn: firebaseReady && db ? serverTimestamp() : new Date().toISOString(),
  };

  if (!firebaseReady || !db) {
    const state = readLocalState();
    const current = state.mapeos[groupId] ?? [];
    const index = current.findIndex((item) => normalizeKey(item.columnaPooler) === normalizeKey(payload.columnaPooler));
    const stored = { ...nextMapping, actualizadoEn: new Date().toISOString() };
    if (index >= 0) current[index] = stored;
    else current.push(stored);
    state.mapeos[groupId] = current;
    writeLocalState(state);
    return stored;
  }

  await setDoc(doc(db, 'mapeos', groupId, 'conceptos', payload.columnaPooler), nextMapping);
  return nextMapping;
}

export async function saveMappings(groupId, mappings) {
  const saved = [];
  for (const mapping of mappings) {
    saved.push(await saveMapping(groupId, mapping));
  }
  return saved;
}

export async function saveCatalogConcept(concept) {
  const payload = {
    codigo: String(concept.codigo),
    nombre: String(concept.nombre),
    tipo: concept.tipo || 'Dato',
    habilitado: concept.habilitado !== false,
  };

  if (!firebaseReady || !db) {
    const state = readLocalState();
    const index = state.catalogoConceptos.findIndex((item) => normalizeKey(item.codigo) === normalizeKey(payload.codigo));
    if (index >= 0) state.catalogoConceptos[index] = payload;
    else state.catalogoConceptos.push(payload);
    writeLocalState(state);
    return payload;
  }

  await setDoc(doc(db, 'catalogoConceptos', payload.codigo), payload);
  return payload;
}

export async function saveCatalogConcepts(concepts) {
  if (!firebaseReady || !db) {
    const state = readLocalState();
    concepts.forEach((concept) => {
      const payload = {
        codigo: String(concept.codigo),
        nombre: String(concept.nombre),
        tipo: concept.tipo || 'Dato',
        habilitado: concept.habilitado !== false,
      };
      const index = state.catalogoConceptos.findIndex((item) => normalizeKey(item.codigo) === normalizeKey(payload.codigo));
      if (index >= 0) state.catalogoConceptos[index] = payload;
      else state.catalogoConceptos.push(payload);
    });
    writeLocalState(state);
    return concepts;
  }

  const batch = writeBatch(db);
  concepts.forEach((concept) => {
    const payload = {
      codigo: String(concept.codigo),
      nombre: String(concept.nombre),
      tipo: concept.tipo || 'Dato',
      habilitado: concept.habilitado !== false,
    };
    batch.set(doc(db, 'catalogoConceptos', payload.codigo), payload);
  });
  await batch.commit();
  return concepts;
}

export async function toggleCatalogConcept(concept, habilitado) {
  const nextConcept = { ...concept, habilitado };
  if (!firebaseReady || !db) {
    return saveCatalogConcept(nextConcept);
  }

  await updateDoc(doc(db, 'catalogoConceptos', concept.codigo), { habilitado });
  return nextConcept;
}

export async function seedBaseData() {
  if (!firebaseReady || !db) {
    writeLocalState(createSeedState());
    return createSeedState();
  }

  const batch = writeBatch(db);
  GROUPS.forEach((group) => {
    batch.set(doc(db, 'grupos', group.id), group);
  });
  SEED_CATALOG.forEach((concept) => {
    batch.set(doc(db, 'catalogoConceptos', concept.codigo), concept);
  });
  AVESA_MAPPINGS.forEach((mapping) => {
    batch.set(doc(db, 'mapeos', 'grupo_avesa', 'conceptos', mapping.columnaPooler), {
      ...mapping,
      confirmadoPor: auth?.currentUser?.email ?? 'seed@swat.local',
      actualizadoEn: serverTimestamp(),
    });
  });
  await batch.commit();
  return true;
}

function normalizeMappingPayload(mapping) {
  return {
    columnaPooler: String(mapping.columnaPooler).trim(),
    codigoConcepto: String(mapping.codigoConcepto).trim(),
    objetoFuncion: String(mapping.objetoFuncion ?? '').trim(),
    multiplicador: Number(mapping.multiplicador ?? 1),
    redondeo: mapping.redondeo || 'ninguno',
  };
}

function hydrateMappings(groupId, mappings) {
  if (groupId !== 'grupo_avesa') {
    return mappings.map((mapping) => ({
      ...mapping,
      objetoFuncion: mapping.objetoFuncion ?? defaultFunctionObject(mapping.codigoConcepto),
    }));
  }

  const defaults = new Map(AVESA_MAPPINGS.map((mapping) => [normalizeKey(mapping.columnaPooler), mapping]));
  return mappings.map((mapping) => {
    const seeded = defaults.get(normalizeKey(mapping.columnaPooler));
    return {
      ...mapping,
      objetoFuncion: mapping.objetoFuncion ?? seeded?.objetoFuncion ?? defaultFunctionObject(mapping.codigoConcepto),
    };
  });
}

function defaultFunctionObject(codigoConcepto) {
  const conceptKey = normalizeKey(codigoConcepto);
  const functionMatch = FUNCTION_CATALOG.find((item) => normalizeKey(item.id) === conceptKey);
  return functionMatch?.id ?? '';
}
