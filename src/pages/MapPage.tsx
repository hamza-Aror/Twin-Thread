import { lazy, Suspense, useEffect, useId, useState, type FormEvent } from 'react';
import { Flag, Plus } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { Button, Chip, Field, Notice, PageHeader, Panel, inputClass } from '../components/ui';
import { RESOURCE_COLORS } from '../data/resources';
import { PlacesStatusLine, ResourceDetails, ResourceLegend, displayName, sourceTag } from '../components/ResourceDetails';
import { useResources } from '../hooks/useResources';
import { addReport, addSuggestion, loadReports, removeSuggestion, validateSuggestion, type SuggestionError } from '../services/resourceStore';
import type { ResourceType } from '../types/resources';

// Leaflet is only needed on this page, so it is loaded on demand.
const ResourceMap = lazy(() => import('../components/ResourceMap').then((m) => ({ default: m.ResourceMap })));

/** Filters for mapped places. User reports have their own toggle. */
const TYPES: Array<Extract<ResourceType, 'water' | 'park' | 'indoor'>> = ['water', 'park', 'indoor'];
/** Types a user can suggest. They are always stored as unverified reports. */
type ReportType = Extract<ResourceType, 'water' | 'cooling' | 'assistance'>;
const REPORT_TYPES: ReportType[] = ['water', 'cooling', 'assistance'];

export function MapPage() {
  const { t } = useI18n();
  const { location, demoMode } = useApp();
  const id = useId();
  const { types: typesOn, toggleType, includeReports: showReports, setIncludeReports: setShowReports, visible, counts, reloadSuggestions, places, retry } = useResources(location, demoMode);
  const [reports, setReports] = useState(loadReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState({ type: 'water' as ReportType, name: '', description: '', lat: '', lon: '', hours: '', accessibility: '' });
  const [formErrors, setFormErrors] = useState<SuggestionError[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');

  const center: [number, number] = [location.latitude, location.longitude];
  // A new city clears the selection so the previous city's details never linger.
  useEffect(() => setSelectedId(null), [location.id]);
  const selected = visible.find((x) => x.r.id === selectedId) ?? null;
  const reportCount = (rid: string) => reports.filter((x) => x.resourceId === rid).length;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      type: form.type,
      name: form.name,
      description: form.description,
      latitude: Number.parseFloat(form.lat),
      longitude: Number.parseFloat(form.lon),
      hours: form.hours,
      accessibility: form.accessibility,
      areaId: location.id,
    };
    const errors = validateSuggestion(input);
    setFormErrors(errors);
    if (errors.length) return;
    const saved = addSuggestion(input);
    reloadSuggestions();
    setSelectedId(saved.id);
    setFormOpen(false);
    setPicking(false);
    setForm({ type: 'water', name: '', description: '', lat: '', lon: '', hours: '', accessibility: '' });
    setFlash(t('map.form.saved'));
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('map.title')} intro={t('map.intro')}>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} aria-hidden />
          {t('map.suggest')}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('map.filters')}>
        {TYPES.map((ty) => (
          <Chip key={ty} pressed={typesOn[ty]} onClick={() => toggleType(ty)} color={RESOURCE_COLORS[ty]}>
            {t(`map.chip.${ty}`)}
            {places.status !== 'loading' && <span className="num text-faint">{counts[ty]}</span>}
          </Chip>
        ))}
        <Chip pressed={showReports} onClick={() => setShowReports(!showReports)}>
          {t('map.showReports')}
        </Chip>
      </div>

      {flash && (
        <Notice tone="info" role="status">
          {flash}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Suspense fallback={<div className="flex h-[420px] items-center justify-center rounded-xl border border-line bg-raised text-sm text-muted">{t('dash.loadingMap')}</div>}>
            <ResourceMap
              center={center}
              resources={visible.map((x) => x.r)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              picking={picking}
              onPick={(lat, lon) => {
                setForm((f) => ({ ...f, lat: lat.toFixed(5), lon: lon.toFixed(5) }));
                setPicking(false);
              }}
              pickedPoint={formOpen && form.lat && form.lon ? [Number(form.lat), Number(form.lon)] : null}
              centerLabel={`${t('map.center')}: ${location.name}`}
              ariaLabel={t('map.mapLabel')}
              labelFor={(r) => displayName(r, t)}
            />
          </Suspense>
          <div className="mt-2 flex flex-col gap-1.5">
            <ResourceLegend />
            <PlacesStatusLine state={places} count={visible.length} place={location.name} onRetry={retry} />
            <p className="text-xs text-faint">{t('map.tilesNote')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title={t('map.list')}>
            {visible.length === 0 ? (
              <p className="text-sm text-muted">{t('map.empty')}</p>
            ) : (
              <ul className="-mx-1 flex max-h-72 flex-col overflow-y-auto">
                {visible.map(({ r, km }) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-pressed={r.id === selectedId}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-start ${r.id === selectedId ? 'bg-raised' : 'hover:bg-raised/60'}`}
                    >
                      <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RESOURCE_COLORS[r.type] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg">{displayName(r, t)}</span>
                        <span className="block text-xs text-muted">
                          {t(`map.type.${r.type}`)}, <span className="num">{t('map.distance', { km: km.toFixed(1) })}</span>
                        </span>
                        <span className={`mt-0.5 block text-xs ${r.verification === 'official' ? 'text-teal' : r.verification === 'mapped' ? 'text-muted' : 'text-amber'}`}>{sourceTag(r, t)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            {!selected ? (
              <p className="text-sm text-muted">{t('map.selectPrompt')}</p>
            ) : (
              <ResourceDetails
                item={selected}
                footer={
                  <>
                <div className="border-t border-line pt-3">
                  <label htmlFor={`${id}-rn`} className="text-xs text-muted">
                    {t('map.reportNote')}
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input id={`${id}-rn`} className={inputClass} value={reportNote} maxLength={200} onChange={(e) => setReportNote(e.target.value)} />
                    <Button
                      onClick={() => {
                        addReport(selected.r.id, reportNote);
                        setReports(loadReports());
                        setReportNote('');
                        setFlash(t('map.reportSaved', { n: reportCount(selected.r.id) + 1 }));
                      }}
                    >
                      <Flag size={14} aria-hidden />
                      {t('map.report')}
                    </Button>
                  </div>
                  {reportCount(selected.r.id) > 0 && <p className="mt-1 text-xs text-faint">{t('map.reportSaved', { n: reportCount(selected.r.id) })}</p>}
                </div>
                {selected.r.verification === 'unverified_report' && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      removeSuggestion(selected.r.id);
                      reloadSuggestions();
                      setSelectedId(null);
                    }}
                  >
                    {t('map.form.delete')}
                  </Button>
                )}
                  </>
                }
              />
            )}
          </Panel>
        </div>
      </div>

      {formOpen && (
        <Panel title={t('map.suggest')}>
          <p className="mb-4 text-sm text-muted">{t('map.suggestIntro')}</p>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label={t('map.form.type')} htmlFor={`${id}-ty`}>
              <select id={`${id}-ty`} className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ReportType })}>
                {REPORT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`map.reportType.${ty}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('map.form.name')} htmlFor={`${id}-nm`}>
              <input id={`${id}-nm`} className={inputClass} value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('map.form.description')} htmlFor={`${id}-ds`}>
                <textarea id={`${id}-ds`} className={inputClass} rows={2} value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <Field label={t('loc.lat')} htmlFor={`${id}-la`}>
              <input id={`${id}-la`} type="number" step="0.0001" className={inputClass} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            </Field>
            <Field label={t('loc.lon')} htmlFor={`${id}-lo`}>
              <input id={`${id}-lo`} type="number" step="0.0001" className={inputClass} value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button onClick={() => setPicking(!picking)} ariaPressed={picking}>
                {picking ? t('map.form.picking') : t('map.form.pick')}
              </Button>
            </div>
            <Field label={t('map.form.hours')} htmlFor={`${id}-hr`}>
              <input id={`${id}-hr`} className={inputClass} value={form.hours} maxLength={80} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            </Field>
            <Field label={t('map.form.accessibility')} htmlFor={`${id}-ac`}>
              <input id={`${id}-ac`} className={inputClass} value={form.accessibility} maxLength={120} onChange={(e) => setForm({ ...form, accessibility: e.target.value })} />
            </Field>
            {formErrors.length > 0 && (
              <div className="sm:col-span-2">
                <Notice tone="danger" role="alert">
                  <ul className="list-disc ps-5">
                    {formErrors.map((er) => (
                      <li key={er}>{t(`map.err.${er}`)}</li>
                    ))}
                  </ul>
                </Notice>
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="primary">
                {t('map.form.save')}
              </Button>
              <Button
                onClick={() => {
                  setFormOpen(false);
                  setPicking(false);
                  setFormErrors([]);
                }}
              >
                {t('map.form.cancel')}
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
