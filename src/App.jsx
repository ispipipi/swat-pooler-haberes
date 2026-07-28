import Fuse from 'fuse.js';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Layers3,
  Lock,
  LogOut,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FUNCTION_CATALOG, REDONDEO_OPTIONS } from './data/seeds.js';
import { useAuth } from './hooks/useAuth.js';
import { ERRORS } from './lib/errors.js';
import { analyzePooler, downloadOutputWorkbook, readCatalogExcel, readPooler } from './lib/excel.js';
import { firebaseMissingMessage } from './lib/firebaseClient.js';
import {
  loadCatalog,
  loadGroups,
  loadMappings,
  saveCatalogConcepts,
  saveMapping,
  seedBaseData,
  toggleCatalogConcept,
} from './lib/repository.js';
import { normalizeKey } from './lib/text.js';

const EMPTY_ROUTE = { name: 'home', groupId: null };

export default function App() {
  const auth = useAuth();
  const [route, setRoute] = useState(parseRoute());
  const [groups, setGroups] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [pooler, setPooler] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedGroup = groups.find((group) => group.id === route.groupId) ?? null;

  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    if (redirect) {
      window.history.replaceState({}, '', withBase(redirect.startsWith('/') ? redirect : `/${redirect}`));
      setRoute(parseRoute());
      return undefined;
    }

    const onPopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    void refreshBaseData();
  }, [auth.loading, auth.user]);

  useEffect(() => {
    if (!route.groupId || auth.loading) return;
    void refreshMappings(route.groupId);
  }, [route.groupId, auth.loading, auth.user]);

  useEffect(() => {
    if (!pooler) {
      setAnalysis(null);
      return;
    }

    try {
      setAnalysis(analyzePooler(pooler, mappings, catalog));
      setNotice('');
    } catch (error) {
      setAnalysis(null);
      setNotice(error instanceof Error ? error.message : 'El motor Swat no pudo analizar este Pooler.');
    }
  }, [pooler, mappings, catalog]);

  async function refreshBaseData() {
    setBusy(true);
    try {
      const [nextGroups, nextCatalog] = await Promise.all([loadGroups(), loadCatalog()]);
      setGroups(nextGroups);
      setCatalog(nextCatalog);
    } catch {
      setNotice('No pudimos cargar grupos y catálogo desde Firestore. Revisa conexión y permisos del proyecto Firebase.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshMappings(groupId) {
    setBusy(true);
    try {
      setMappings(await loadMappings(groupId));
    } catch {
      setNotice('No pudimos cargar el mantenedor de este grupo. Revisa permisos sobre /mapeos/{grupoId}/conceptos.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSeed() {
    setBusy(true);
    try {
      await seedBaseData();
      await refreshBaseData();
      if (route.groupId) await refreshMappings(route.groupId);
      setNotice('Base Swat sincronizada: grupos, catálogo mínimo y 20 mapeos AVESA confirmados quedaron disponibles.');
    } catch {
      setNotice('No pudimos sembrar la base inicial. Revisa credenciales Firebase y reglas de escritura de Firestore.');
    } finally {
      setBusy(false);
    }
  }

  function navigate(path) {
    window.history.pushState({}, '', withBase(path));
    setRoute(parseRoute());
  }

  function selectGroup(groupId) {
    navigate(`/grupo/${groupId}/cargar`);
  }

  async function handlePoolerFile(file) {
    setBusy(true);
    try {
      const nextPooler = await readPooler(file);
      setPooler(nextPooler);
      setNotice(`Pooler cargado: ${nextPooler.dataRows.length} colaboradores y ${nextPooler.conceptColumns.length} columnas variables detectadas.`);
    } catch (error) {
      setPooler(null);
      setNotice(error instanceof Error ? error.message : 'El archivo no pudo leerse como Pooler Swat.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveMapping(mapping) {
    const catalogEntry = catalog.find((concept) => normalizeKey(concept.codigo) === normalizeKey(mapping.codigoConcepto));
    if (!catalogEntry) {
      setNotice(ERRORS.unknownConcept(mapping.codigoConcepto));
      return false;
    }
    if (!catalogEntry.habilitado) {
      setNotice(ERRORS.disabledConcept(mapping.codigoConcepto));
      return false;
    }

    setBusy(true);
    try {
      await saveMapping(route.groupId, mapping);
      await refreshMappings(route.groupId);
      setNotice(`Mapeo confirmado: ${mapping.columnaPooler} → ${mapping.codigoConcepto}${mapping.objetoFuncion ? ` · Objeto ${mapping.objetoFuncion}` : ''}.`);
      return true;
    } catch {
      setNotice('No pudimos guardar el mapeo. Revisa permisos de escritura sobre Firestore y vuelve a intentar.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCatalogImport(file) {
    setBusy(true);
    try {
      const concepts = await readCatalogExcel(file);
      await saveCatalogConcepts(concepts);
      await refreshBaseData();
      setNotice(`Catálogo actualizado: ${concepts.length} conceptos leídos desde Excel.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos importar el catálogo maestro.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleConcept(concept) {
    setBusy(true);
    try {
      await toggleCatalogConcept(concept, !concept.habilitado);
      await refreshBaseData();
      setNotice(`${concept.codigo} quedó ${concept.habilitado ? 'deshabilitado' : 'habilitado'} en el catálogo maestro.`);
    } catch {
      setNotice('No pudimos actualizar el concepto. Revisa permisos de escritura del catálogo maestro.');
    } finally {
      setBusy(false);
    }
  }

  function goPreviewIfReady() {
    if (!analysis?.output) {
      setNotice(ERRORS.pendingMappings);
      return;
    }
    navigate(`/grupo/${route.groupId}/preview`);
  }

  if (auth.loading) {
    return <LoadingScreen />;
  }

  if (auth.firebaseReady && !auth.user) {
    return <LoginScreen auth={auth} />;
  }

  return (
    <div className="app-canvas min-h-screen text-ink">
      <AppHeader
        user={auth.user}
        auth={auth}
        group={selectedGroup}
        route={route}
        onNavigate={navigate}
        onSeed={handleSeed}
        busy={busy}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {!auth.firebaseReady ? (
          <Banner tone="warning" title="Modo local de respaldo">
            {firebaseMissingMessage} Mientras tanto puedes probar AVESA con semillas locales; al configurar Firebase, los mismos flujos escriben en Firestore.
          </Banner>
        ) : null}

        {notice ? (
          <Banner tone={notice.includes('No pudimos') || notice.includes('Falta') ? 'danger' : 'info'} title="Bitácora Swat">
            {notice}
          </Banner>
        ) : null}

        {route.name === 'home' ? (
          <GroupSelector groups={groups} onSelect={selectGroup} busy={busy} />
        ) : null}

        {route.name === 'cargar' && selectedGroup ? (
          <UploadView
            group={selectedGroup}
            pooler={pooler}
            analysis={analysis}
            busy={busy}
            onPoolerFile={handlePoolerFile}
            onGoMaintainer={() => navigate(`/grupo/${selectedGroup.id}/mantenedor`)}
            onGoPreview={goPreviewIfReady}
          />
        ) : null}

        {route.name === 'mantenedor' && selectedGroup ? (
          <MaintainerView
            group={selectedGroup}
            catalog={catalog}
            mappings={mappings}
            analysis={analysis}
            onSaveMapping={handleSaveMapping}
            onCatalogImport={handleCatalogImport}
            onToggleConcept={handleToggleConcept}
            onBack={() => navigate(`/grupo/${selectedGroup.id}/cargar`)}
          />
        ) : null}

        {route.name === 'preview' && selectedGroup ? (
          <PreviewView
            group={selectedGroup}
            pooler={pooler}
            analysis={analysis}
            onDownload={() => analysis?.output && downloadOutputWorkbook(analysis.output, pooler?.fileName)}
            onBack={() => navigate(`/grupo/${selectedGroup.id}/cargar`)}
          />
        ) : null}
      </main>
    </div>
  );
}

function AppHeader({ user, auth, group, route, onNavigate, onSeed, busy }) {
  const steps = [
    { id: 'cargar', label: 'Carga', detail: 'Pooler Base' },
    { id: 'mantenedor', label: 'Mapeo', detail: 'Conceptos' },
    { id: 'preview', label: 'Preview', detail: 'Excel final' },
  ];

  return (
    <header className="top-shell">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
              <span className="brand-mark"><ShieldCheck size={17} /></span>
              <span>Swat Orchestrator</span>
              {group ? <span className="header-chip">{group.nombre}</span> : null}
              <span className="header-chip subtle">v1.1.1</span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-normal text-white sm:text-4xl">
              Pooler a carga masiva de haberes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Consola operativa para convertir novedades mensuales en un Excel validado, con mapeo persistente por grupo y control de gates antes de exportar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button className="btn-header" type="button" onClick={onSeed} disabled={busy}>
              <Database size={16} />
              Sembrar base
            </button>
            <button className="btn-header" type="button" onClick={() => onNavigate('/')}>
              <Building2 size={16} />
              Grupos
            </button>
            {auth.firebaseReady ? (
              <button className="btn-header" type="button" onClick={auth.logout}>
                <LogOut size={16} />
                {user?.email ?? 'Salir'}
              </button>
            ) : null}
          </div>
        </div>

        {group ? (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <button
                key={step.id}
                className={route.name === step.id ? 'step-card active' : 'step-card'}
                onClick={() => onNavigate(`/grupo/${group.id}/${step.id}`)}
                type="button"
              >
                <span className="step-index">{index + 1}</span>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function GroupSelector({ groups, onSelect, busy }) {
  return (
    <section className="space-y-6">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Gate 1</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Selecciona grupo empresa</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Cada grupo conserva su propio mantenedor de conceptos. Elegir bien acá evita mezclar reglas, códigos y decisiones pendientes.
          </p>
        </div>
        <div className="hero-meter">
          <span>Grupos activos</span>
          <strong>{groups.length}</strong>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((group) => (
          <button key={group.id} className="group-card" type="button" onClick={() => onSelect(group.id)} disabled={busy}>
            <div className="flex items-center justify-between">
              <span className="status-pill ok">Activo</span>
              <Building2 className="text-swat-600" size={21} />
            </div>
            <h3 className="mt-5 text-xl font-black text-slate-950">{group.nombre}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">Abrir flujo de carga, propuesta y preview con reglas propias.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-swat-700">
              Entrar al flujo <ArrowRight size={15} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function UploadView({ group, pooler, analysis, busy, onPoolerFile, onGoMaintainer, onGoPreview }) {
  const output = analysis?.output;
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="panel">
        <div className="section-title">
          <div className="section-icon"><FileSpreadsheet size={20} /></div>
          <div>
            <p className="eyebrow">Gate 4</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Carga de Pooler · {group.nombre}</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          Solo se procesa la hoja Base. Las columnas variables se detectan desde Atrasos hacia la derecha y se cruzan contra mapeos confirmados.
        </p>

        <FileDrop
          label="Subir Pooler"
          description="Archivo Excel mensual de novedades. Los RUT y montos se procesan solo en memoria."
          icon={<FileSpreadsheet size={22} />}
          onFile={onPoolerFile}
        />

        {pooler ? (
          <ColumnAudit analysis={analysis} onGoMaintainer={onGoMaintainer} />
        ) : null}
      </div>

      <aside className="panel h-fit">
        <div className="section-title compact">
          <div className="section-icon"><Activity size={18} /></div>
          <div>
            <p className="eyebrow">Estado</p>
            <h3 className="text-lg font-black text-slate-950">Control de avance</h3>
          </div>
        </div>
        <Metric label="Colaboradores" value={pooler?.dataRows.length ?? 0} />
        <Metric label="Columnas variables" value={pooler?.conceptColumns.length ?? 0} />
        <Metric label="Pendientes con valores" value={analysis?.pendingColumns.length ?? 0} />
        <Metric label="Valores exportables" value={output?.valueCount ?? 0} />
        <button className="btn-primary mt-5 w-full" type="button" disabled={busy || !output} onClick={onGoPreview}>
          Ver vista previa
        </button>
      </aside>
    </section>
  );
}

function ColumnAudit({ analysis, onGoMaintainer }) {
  if (!analysis) return null;
  const pendingWithValues = analysis.pendingColumns;
  const conceptsWithValues = [...analysis.columns]
    .filter((item) => item.hasValues)
    .sort((a, b) => statusWeight(a.status) - statusWeight(b.status) || a.order - b.order);
  const emptyColumns = [...analysis.columns]
    .filter((item) => !item.hasValues)
    .sort((a, b) => a.order - b.order);
  const grandTotal = conceptsWithValues.reduce((sum, item) => sum + item.total, 0);
  const grandCount = conceptsWithValues.reduce((sum, item) => sum + item.valueCount, 0);

  return (
    <div className="mt-6">
      {pendingWithValues.length > 0 ? (
        <Banner tone="danger" title="Columnas bloqueadas">
          {pendingWithValues.map((item) => item.columnName).join(', ')} requieren confirmación antes de transformar datos.
        </Banner>
      ) : (
        <Banner tone="success" title="Mapeo listo">
          Todas las columnas con valores tienen código confirmado y habilitado.
        </Banner>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ConceptSummaryCard label="Conceptos con datos" value={conceptsWithValues.length} />
        <ConceptSummaryCard label="Registros informados" value={grandCount} />
        <ConceptSummaryCard label="Sumatoria total" value={formatAuditNumber(grandTotal)} />
      </div>

      <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <h3 className="text-sm font-black text-slate-950">Conceptos a revisar / mapear</h3>
          <p className="mt-1 text-xs text-muted">Solo columnas con al menos un valor informado. Las sumatorias usan el valor final transformado si el mapeo está confirmado.</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Columna Pooler</th>
              <th>Estado</th>
              <th>Código</th>
              <th>N°</th>
              <th>Sumatoria</th>
            </tr>
          </thead>
          <tbody>
            {conceptsWithValues.map((item) => (
              <tr key={item.columnName}>
                <td className="font-semibold">{item.columnName}</td>
                <td><StatusBadge status={item.status} /></td>
                <td>{item.mapping?.codigoConcepto ?? 'Sin asignar'}</td>
                <td className="font-mono text-xs font-bold tabular-nums">{item.valueCount}</td>
                <td className="font-mono text-xs font-bold tabular-nums">{formatAuditNumber(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {emptyColumns.length > 0 ? (
        <div className="mt-4 overflow-auto rounded-lg border border-slate-200 bg-white/70">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-black text-slate-950">Columnas vacías detectadas</h3>
            <p className="mt-1 text-xs text-muted">Se muestran separadas para que no ensucien la revisión operativa. No participan en el Excel final.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Columna Pooler</th>
                <th>Estado</th>
                <th>Código</th>
              </tr>
            </thead>
            <tbody>
              {emptyColumns.map((item) => (
                <tr key={item.columnName}>
                  <td className="font-semibold text-slate-500">{item.columnName}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="text-slate-500">{item.mapping?.codigoConcepto ?? 'Sin asignar'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pendingWithValues.length > 0 ? (
        <button className="btn-primary mt-4" type="button" onClick={onGoMaintainer}>
          Resolver en mantenedor
        </button>
      ) : null}
    </div>
  );
}

function ConceptSummaryCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MaintainerView({ group, catalog, mappings, analysis, onSaveMapping, onCatalogImport, onToggleConcept, onBack }) {
  const [catalogQuery, setCatalogQuery] = useState('');
  const [functionQuery, setFunctionQuery] = useState('');
  const draftRows = useMemo(() => buildDraftRows(mappings, analysis, catalog), [mappings, analysis, catalog]);
  const visibleCatalog = catalog
    .filter((concept) => `${concept.codigo} ${concept.nombre}`.toLowerCase().includes(catalogQuery.toLowerCase()))
    .slice(0, 80);
  const visibleFunctions = FUNCTION_CATALOG
    .filter((item) => `${item.id} ${item.nombre} ${item.tipo}`.toLowerCase().includes(functionQuery.toLowerCase()))
    .slice(0, 80);

  return (
    <section className="space-y-5">
      <div className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="section-title">
              <div className="section-icon"><SlidersHorizontal size={20} /></div>
              <div>
                <p className="eyebrow">Gate 2/3</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Mantenedor de conceptos · {group.nombre}</h2>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">
              Edita código, objeto/función, multiplicador y redondeo. Una fila no confirmada no participa en la exportación.
            </p>
          </div>
          <button className="btn-ghost" type="button" onClick={onBack}>
            Volver a carga
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-black">Mapeo por grupo</h3>
          <span className="status-pill neutral">{draftRows.length} reglas</span>
        </div>
        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="data-table min-w-[1220px]">
            <thead>
              <tr>
                <th>Columna Pooler</th>
                <th>Código concepto</th>
                <th>Objeto / función</th>
                <th>Multiplicador</th>
                <th>Redondeo</th>
                <th>Estado</th>
                <th>Sugerencia</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row) => (
                <MappingRow key={row.columnaPooler} row={row} catalog={catalog} onSave={onSaveMapping} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="section-title compact">
            <div className="section-icon"><Activity size={18} /></div>
            <div>
              <h3 className="text-lg font-black">Listado de funciones</h3>
              <p className="mt-1 text-xs text-muted">Usa el ID como Objeto cuando el concepto se calcule mediante función.</p>
            </div>
          </div>
          <label className="relative block md:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input className="input pl-9" value={functionQuery} onChange={(event) => setFunctionQuery(event.target.value)} placeholder="Buscar función" />
          </label>
        </div>
        <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-slate-200">
          <table className="data-table min-w-[920px]">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Aclaración</th>
                <th>Función</th>
              </tr>
            </thead>
            <tbody>
              {visibleFunctions.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs font-bold">{item.id}</td>
                  <td>{item.nombre}</td>
                  <td>{item.tipo}</td>
                  <td className="text-xs text-muted">{item.aclaracion || '-'}</td>
                  <td className="max-w-[420px] truncate font-mono text-xs text-muted" title={item.funcion}>{item.funcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="panel">
          <div className="section-title compact">
            <div className="section-icon"><Layers3 size={18} /></div>
            <h3 className="text-lg font-black">Importar catálogo maestro</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Lee el Excel Lista de conceptos y actualiza `/catalogoConceptos` con `codigo`, `nombre`, `tipo` y `habilitado`.
          </p>
          <FileDrop
            compact
            label="Importar Lista de conceptos"
            description="Columnas mínimas: Concepto y Nombre."
            icon={<Upload size={20} />}
            onFile={onCatalogImport}
          />
        </div>

        <div className="panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="section-title compact">
              <div className="section-icon"><Search size={18} /></div>
              <h3 className="text-lg font-black">Catálogo maestro</h3>
            </div>
            <label className="relative block md:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input className="input pl-9" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Buscar código o nombre" />
            </label>
          </div>
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Uso</th>
                </tr>
              </thead>
              <tbody>
                {visibleCatalog.map((concept) => (
                  <tr key={concept.codigo}>
                    <td className="font-mono text-xs font-bold">{concept.codigo}</td>
                    <td>{concept.nombre}</td>
                    <td>{concept.tipo}</td>
                    <td>
                      <button className={concept.habilitado ? 'btn-mini-success' : 'btn-mini'} type="button" onClick={() => onToggleConcept(concept)}>
                        {concept.habilitado ? 'Habilitado' : 'Deshabilitado'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function MappingRow({ row, catalog, onSave }) {
  const [codigoConcepto, setCodigoConcepto] = useState(row.codigoConcepto);
  const [objetoFuncion, setObjetoFuncion] = useState(row.objetoFuncion);
  const [multiplicador, setMultiplicador] = useState(row.multiplicador);
  const [redondeo, setRedondeo] = useState(row.redondeo);

  useEffect(() => {
    setCodigoConcepto(row.codigoConcepto);
    setObjetoFuncion(row.objetoFuncion);
    setMultiplicador(row.multiplicador);
    setRedondeo(row.redondeo);
  }, [row]);

  const conceptExists = catalog.some((concept) => normalizeKey(concept.codigo) === normalizeKey(codigoConcepto) && concept.habilitado);
  const functionExists = !objetoFuncion || FUNCTION_CATALOG.some((item) => normalizeKey(item.id) === normalizeKey(objetoFuncion));

  function handleConceptChange(value) {
    setCodigoConcepto(value);
    if (!objetoFuncion) {
      setObjetoFuncion(defaultFunctionObject(value));
    }
  }

  return (
    <tr>
      <td className="font-semibold">{row.columnaPooler}</td>
      <td>
        <input className="input min-w-48 font-mono text-xs" value={codigoConcepto} onChange={(event) => handleConceptChange(event.target.value)} list="conceptos-list" />
        <datalist id="conceptos-list">
          {catalog.map((concept) => (
            <option key={concept.codigo} value={concept.codigo}>{concept.nombre}</option>
          ))}
        </datalist>
      </td>
      <td>
        <input className="input min-w-44 font-mono text-xs" value={objetoFuncion} onChange={(event) => setObjetoFuncion(event.target.value)} list="funciones-list" placeholder="Vacío si no aplica" />
        <datalist id="funciones-list">
          {FUNCTION_CATALOG.map((item) => (
            <option key={item.id} value={item.id}>{item.nombre}</option>
          ))}
        </datalist>
        {!functionExists ? <p className="mt-1 text-[11px] font-bold text-amber-700">No está en listado</p> : null}
      </td>
      <td>
        <input className="input w-28" value={multiplicador} onChange={(event) => setMultiplicador(event.target.value)} />
      </td>
      <td>
        <select className="input w-32" value={redondeo} onChange={(event) => setRedondeo(event.target.value)}>
          {REDONDEO_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </td>
      <td><StatusBadge status={row.status} /></td>
      <td className="text-xs text-muted">{row.suggestion ? `${row.suggestion.codigo} · ${row.suggestion.nombre}` : 'Sin sugerencia'}</td>
      <td>
        <button
          className={conceptExists ? 'btn-mini-success' : 'btn-mini'}
          type="button"
          onClick={() => onSave({ columnaPooler: row.columnaPooler, codigoConcepto, objetoFuncion, multiplicador, redondeo })}
        >
          <Save size={13} />
          Confirmar
        </button>
      </td>
    </tr>
  );
}

function PreviewView({ group, pooler, analysis, onDownload, onBack }) {
  const output = analysis?.output;
  if (!pooler) {
    return (
      <div className="panel">
        <p className="eyebrow">Gate 5</p>
        <h2 className="mt-2 text-2xl font-black">No hay Pooler cargado</h2>
        <p className="mt-2 text-sm text-muted">Vuelve a carga y sube un archivo antes de revisar la vista previa.</p>
        <button className="btn-primary mt-4" type="button" onClick={onBack}>Volver a carga</button>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="panel">
        <Banner tone="danger" title="Preview bloqueada">{ERRORS.pendingMappings}</Banner>
        <button className="btn-primary mt-4" type="button" onClick={onBack}>Volver a carga</button>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="section-title">
              <div className="section-icon"><FileCheck2 size={20} /></div>
              <div>
                <p className="eyebrow">Gate 5/6</p>
                <h2 className="mt-1 text-2xl font-black">Vista previa · {group.nombre}</h2>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">La tabla replica el output final: una fila por movimiento informado, en formato CSV detalle separado por punto y coma.</p>
          </div>
          <button className="btn-primary" type="button" onClick={onDownload}>
            <Download size={16} />
            Descargar CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <MetricPanel label="Filas detalle" value={output.rowCount} />
        <MetricPanel label="Colaboradores" value={output.collaboratorCount ?? '-'} />
        <MetricPanel label="Conceptos activos" value={output.conceptCount} />
        <MetricPanel label="Con función" value={output.control?.functionRows ?? 0} />
        <MetricPanel label="Sin función" value={output.control?.manualRows ?? 0} />
      </div>

      <div className="panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="section-title compact">
              <div className="section-icon"><ShieldCheck size={18} /></div>
              <div>
                <p className="eyebrow">Control previo</p>
                <h3 className="text-lg font-black">Resumen antes de descargar</h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">
              Valida filas, sumatorias y origen por concepto. `F` aparece solo cuando hay Objeto/función; sin función se informa como `M`.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted">Sumatoria general</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{formatAuditNumber(output.control?.total ?? 0)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="data-table min-w-[940px]">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Origen</th>
                <th>Objeto</th>
                <th>Filas</th>
                <th>Colaboradores</th>
                <th>Sumatoria</th>
              </tr>
            </thead>
            <tbody>
              {output.control?.conceptSummary.map((item) => (
                <tr key={`${item.concepto}-${item.objeto || 'manual'}`}>
                  <td className="font-mono text-xs font-bold">{item.concepto}</td>
                  <td><span className={item.origen === 'F' ? 'status-pill ok' : 'status-pill neutral'}>{item.origen}</span></td>
                  <td className="font-mono text-xs text-muted">{item.objeto || 'Sin función'}</td>
                  <td>{item.filas}</td>
                  <td>{item.colaboradores}</td>
                  <td className="font-mono text-xs font-bold">{formatAuditNumber(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="max-h-[620px] overflow-auto rounded-lg border border-slate-200">
          <table className="data-table min-w-[1560px]">
            <thead>
              <tr>{output.headers.map((header) => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {output.rows.slice(0, 80).map((row, index) => (
                <tr key={`${row[0]}-${index}`}>
                  {output.headers.map((header, cellIndex) => (
                    <td key={`${header}-${cellIndex}`} className={cellIndex === 0 ? 'font-mono text-xs' : ''}>
                      {formatPreviewCell(row[cellIndex])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FileDrop({ label, description, icon, onFile, compact = false }) {
  return (
    <label className={`file-drop ${compact ? 'min-h-36' : 'min-h-44'}`}>
      <span className="flex items-center gap-3 font-black text-slate-950"><span className="file-drop-icon">{icon}</span>{label}</span>
      <span className="mt-2 text-sm leading-6 text-muted">{description}</span>
      <span className="mt-4 inline-flex w-fit items-center rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-black text-swat-700">Solo Excel .xlsx/.xls</span>
      <input className="sr-only" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} />
    </label>
  );
}

function LoginScreen({ auth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="app-canvas flex min-h-screen items-center justify-center px-4">
      <section className="panel w-full max-w-md">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-swat-50 text-swat-700">
          <Lock size={24} />
        </div>
        <p className="eyebrow mt-5">Acceso interno NPR/artBPO</p>
        <h1 className="mt-2 text-2xl font-black">Entrar a Swat Pooler Haberes</h1>
        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void auth.login(email, password); }}>
          <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo interno" type="email" />
          <input className="input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="contraseña" type="password" />
          {auth.error ? <Banner tone="danger" title="Acceso detenido">{auth.error}</Banner> : null}
          <button className="btn-primary w-full" type="submit">Ingresar</button>
        </form>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="app-canvas flex min-h-screen items-center justify-center">
      <div className="panel flex items-center gap-3">
        <RefreshCcw className="animate-spin text-swat-600" size={20} />
        <span className="font-bold">Cargando Swat...</span>
      </div>
    </main>
  );
}

function Banner({ tone = 'info', title, children }) {
  const toneClass = {
    info: 'banner-info',
    success: 'banner-success',
    warning: 'banner-warning',
    danger: 'banner-danger',
  }[tone];
  return (
    <div className={`mb-5 rounded-lg border p-4 text-sm leading-6 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-2 font-black">
        {tone === 'danger' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-row">
      <span className="text-sm text-muted">{label}</span>
      <strong className="text-2xl font-black text-slate-950">{value}</strong>
    </div>
  );
}

function MetricPanel({ label, value }) {
  return (
    <div className="metric-panel">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = {
    confirmado: 'Confirmado',
    propuesto: 'Propuesto',
    sin_mapear: 'Sin mapear',
  };
  const classes = {
    confirmado: 'status-pill ok',
    propuesto: 'status-pill warn',
    sin_mapear: 'status-pill danger',
  };
  return <span className={classes[status] ?? classes.sin_mapear}>{labels[status] ?? 'Sin mapear'}</span>;
}

function statusWeight(status) {
  const weights = {
    sin_mapear: 0,
    propuesto: 1,
    confirmado: 2,
  };
  return weights[status] ?? 3;
}

function formatAuditNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('es-CL', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatPreviewCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value).replace('.', ',');
  return value;
}

function buildDraftRows(mappings, analysis, catalog) {
  const catalogFuse = new Fuse(catalog.filter((concept) => concept.habilitado), {
    keys: ['nombre', 'codigo'],
    threshold: 0.34,
    includeScore: true,
  });

  const rows = mappings.map((mapping) => ({
    ...mapping,
    objetoFuncion: mapping.objetoFuncion ?? defaultFunctionObject(mapping.codigoConcepto),
    multiplicador: mapping.multiplicador ?? 1,
    redondeo: mapping.redondeo ?? 'ninguno',
    status: 'confirmado',
    suggestion: null,
  }));

  const existing = new Set(rows.map((item) => normalizeKey(item.columnaPooler)));
  analysis?.columns
    .filter((item) => !existing.has(normalizeKey(item.columnName)))
    .forEach((item) => {
      const suggestion = catalogFuse.search(item.columnName)[0]?.item ?? null;
      rows.push({
        columnaPooler: item.columnName,
        codigoConcepto: suggestion?.codigo ?? '',
        objetoFuncion: defaultFunctionObject(suggestion?.codigo),
        multiplicador: normalizeKey(item.columnName) === 'atrasos' ? 60 : 1,
        redondeo: normalizeKey(item.columnName) === 'atrasos' ? 'decimal' : 'ninguno',
        status: suggestion ? 'propuesto' : 'sin_mapear',
        suggestion,
      });
    });

  return rows;
}

function defaultFunctionObject(codigoConcepto) {
  const conceptKey = normalizeKey(codigoConcepto);
  const match = FUNCTION_CATALOG.find((item) => normalizeKey(item.id) === conceptKey);
  return match?.id ?? '';
}

function parseRoute() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = window.location.pathname.startsWith(base)
    ? window.location.pathname.slice(base.length) || '/'
    : window.location.pathname;
  const match = pathname.match(/^\/grupo\/([^/]+)\/([^/]+)/);
  if (!match) return EMPTY_ROUTE;
  const [, groupId, page] = match;
  if (['cargar', 'mantenedor', 'preview'].includes(page)) return { name: page, groupId };
  return EMPTY_ROUTE;
}

function withBase(path) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}
