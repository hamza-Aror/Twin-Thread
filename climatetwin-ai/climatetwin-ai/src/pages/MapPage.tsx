import { lazy, Suspense, useId, useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, Flag, Plus } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { Button, Field, Notice, PageHeader, Panel, inputClass } from '../components/ui';
import { RESOURCE_COLORS, SAMPLE_RESOURCES, distanceKm, externalDirectionsUrl } from '../data/resources';
import { addReport, addSuggestion, loadReports, loadSuggestions, removeSuggestion, validateSuggestion, type SuggestionError } from '../services/resourceStore';
import type { CommunityResource, ResourceType } from '../types/resources';

// Leaflet is only needed on this page, so it is loaded on demand.
const ResourceMap = lazy(() => import('../components/ResourceMap').then((m) => ({ default: m.ResourceMap })));

const TYPES: ResourceType[] = ['water', 'cooling', 'assistance'];
const NEARBY_KM = 25;

export function MapPage() {
  const { t } = useI18n();
  const { location } = useApp();
  const id = useId();
  const [typesOn, setTypesOn] = useState<Record<ResourceType, boolean>>({ water: true, cooling: true, assistance: true });
  const [showReports, setShowReports] = useState(true);
  const [suggestions, setSuggestions] = useState<CommunityResource[]>(loadSuggestions);
  const [reports, setReports] = useState(loadReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState({ type: 'water' as ResourceType, name: '', description: '', lat: '', lon: '', hours: '', accessibility: '' });
  const [formErrors, setFormErrors] = useState<SuggestionError[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');

  const center: [number, number] = [location.latitude, location.longitude];
  const all = useMemo(() => [...SAMPLE_RESOURCES, ...suggestions], [suggestions]);
  const visible = useMemo(
    () =>
      all
        .filter((r) => typesOn[r.type])
        .filter((r) => showReports || r.verification !== 'unverified_report')
        .map((r) => ({ r, km: distanceKm(location.latitude, location.longitude, r.latitude, r.longitude) }))
        .filter((x) => x.km <= NEARBY_KM)
        .sort((a, b) => a.km - b.km),
    [all, typesOn, showReports, location.latitude, location.longitude],
  );
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
    setSuggestions(loadSuggestions());
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

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{t('map.filters')}</legend>
        <span className="me-1 text-sm text-muted">{t('map.filters')}</span>
        {TYPES.map((ty) => (
          <Button key={ty} ariaPressed={typesOn[ty]} onClick={() => setTypesOn({ ...typesOn, [ty]: !typesOn[ty] })} className={typesOn[ty] ? '' : 'opacity-60'}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RESOURCE_COLORS[ty] }} />
            {t(`map.type.${ty}`)}
          </Button>
        ))}
        <Button ariaPressed={showReports} onClick={() => setShowReports(!showReports)} className={showReports ? '' : 'opacity-60'}>
          {t('map.showReports')}
        </Button>
      </fieldset>

      {flash && (
        <Notice tone="info" role="status">
          {flash}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Suspense fallback={<div className="flex h-[420px] items-center justify-center rounded-xl border border-line bg-panel text-muted">…</div>}>
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
            />
          </Suspense>
          <p className="mt-2 text-xs text-faint">{t('map.tilesNote')}</p>
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
                        <span className="block text-sm font-medium text-fg">{r.name}</span>
                        <span className="block text-xs text-muted">
                          {t(`map.type.${r.type}`)}, <span className="num">{t('map.distance', { km: km.toFixed(1) })}</span>
                        </span>
                        <span className={`mt-0.5 block text-xs ${r.verification === 'verified' ? 'text-teal' : 'text-amber'}`}>{t(`map.verification.${r.verification}`)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={selected ? selected.r.name : undefined}>
            {!selected ? (
              <p className="text-sm text-muted">{t('map.selectPrompt')}</p>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                {selected.r.verification !== 'verified' && (
                  <Notice tone="warn">
                    <strong className="font-semibold">{t(`map.verification.${selected.r.verification}`)}.</strong>{' '}
                    {selected.r.verification === 'sample' ? t('map.sampleNote') : t('map.suggestIntro')}
                  </Notice>
                )}
                {selected.r.description && <p className="text-fg">{selected.r.description}</p>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                  <dt className="text-muted">{t('map.form.type')}</dt>
                  <dd>{t(`map.type.${selected.r.type}`)}</dd>
                  <dt className="text-muted">{t('map.hours')}</dt>
                  <dd>
                    {selected.r.hours ?? '—'} {!selected.r.hoursVerified && <span className="text-amber">({t('map.hoursUnverified')})</span>}
                  </dd>
                  <dt className="text-muted">{t('map.accessibility')}</dt>
                  <dd>{selected.r.accessibility ?? t('map.unknown')}</dd>
                  <dt className="text-muted">{t('map.updated')}</dt>
                  <dd className="num">{selected.r.lastUpdated ?? t('map.unknown')}</dd>
                  <dt className="text-muted">{t('map.coords')}</dt>
                  <dd className="num" dir="ltr">
                    {selected.r.latitude.toFixed(4)}, {selected.r.longitude.toFixed(4)}
                  </dd>
                </dl>
                <div>
                  <a href={externalDirectionsUrl(selected.r.latitude, selected.r.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                    {t('map.directions')}
                    <ExternalLink size={14} aria-hidden />
                  </a>
                  <p className="mt-0.5 text-xs text-faint">{t('map.directionsNote')}</p>
                </div>
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
                      setSuggestions(loadSuggestions());
                      setSelectedId(null);
                    }}
                  >
                    {t('map.form.delete')}
                  </Button>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {formOpen && (
        <Panel title={t('map.suggest')}>
          <p className="mb-4 text-sm text-muted">{t('map.suggestIntro')}</p>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label={t('map.form.type')} htmlFor={`${id}-ty`}>
              <select id={`${id}-ty`} className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ResourceType })}>
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`map.type.${ty}`)}
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
