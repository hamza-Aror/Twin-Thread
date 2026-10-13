import { useId, useState } from 'react';
import { ExternalLink, Phone, TriangleAlert } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n, type MessageKey } from '../i18n';
import { Button, CategoryBadge, Field, Notice, PageHeader, Panel, inputClass } from '../components/ui';
import { CATEGORY_COLORS, CATEGORY_ORDER } from '../services/risk/categories';
import { notificationStatus, requestNotificationPermission, showBrowserNotification, type NotificationSupport } from '../services/notifications';
import type { AlertPrefs } from '../services/alerts';
import { formatClock, formatHour, formatTemp } from '../utils/format';

function GuidanceList({ title, keys }: { title: string; keys: MessageKey[] }) {
  const { t } = useI18n();
  return (
    <Panel title={title}>
      <ul className="list-disc space-y-1.5 ps-5 text-sm text-fg">
        {keys.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
    </Panel>
  );
}

export function AlertsPage() {
  const { t } = useI18n();
  const { alerts, weather, current, navigate } = useApp();
  const id = useId();
  const [perm, setPerm] = useState<NotificationSupport>(notificationStatus);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const snap = weather.snapshot;
  const tz = snap?.timezone ?? 'UTC';
  const { prefs, setPrefs } = alerts;
  const update = (patch: Partial<AlertPrefs>) => setPrefs({ ...prefs, ...patch });

  const enableBrowser = async () => {
    const result = await requestNotificationPermission();
    setPerm(result);
    update({ browserNotifications: result === 'granted' });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('alerts.title')} />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title={t('alerts.active')}>
          {!prefs.enabled ? (
            <p className="text-sm text-muted">{t('alerts.disabled')}</p>
          ) : alerts.alerts.length === 0 ? (
            <p className="text-sm text-muted">{t('alerts.none', { n: prefs.lookaheadHours })}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {alerts.alerts.map((a) => (
                <li key={a.id} className="rounded-lg border px-3.5 py-3" style={{ borderColor: `${CATEGORY_COLORS[a.peakCategory]}80` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <TriangleAlert size={16} aria-hidden style={{ color: CATEGORY_COLORS[a.peakCategory] }} />
                    <span className="font-semibold text-fg">{t(a.ongoing ? 'alerts.ongoing' : 'alerts.upcoming', { category: t(`cat.${a.peakCategory}`) })}</span>
                    {a.simulatedData && <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent">{t('alerts.demoTag')}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {t('alerts.body', { start: formatHour(a.startTime, tz), end: formatHour(a.endTime, tz), place: snap?.location.name ?? '', hi: formatTemp(a.peakHeatIndexC) })}
                  </p>
                  <p className="mt-1 text-sm text-fg">{t(`guide.${a.peakCategory}`)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-faint">{t('alerts.rule')}</p>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => navigate('outlook')}>
              {t('alerts.view')}
            </Button>
          </div>
        </Panel>

        <Panel title={t('alerts.prefs')}>
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between gap-3 text-sm text-fg">
              {t('alerts.enable')}
              <input type="checkbox" className="h-5 w-5 accent-[#5cc8e8]" checked={prefs.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
            </label>
            <Field label={t('alerts.threshold')} htmlFor={`${id}-th`}>
              <select id={`${id}-th`} className={inputClass} value={prefs.threshold} onChange={(e) => update({ threshold: e.target.value as AlertPrefs['threshold'] })}>
                {CATEGORY_ORDER.filter((c) => c !== 'lower').map((c) => (
                  <option key={c} value={c}>
                    {t(`cat.${c}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('alerts.lookahead')} htmlFor={`${id}-la`}>
              <select id={`${id}-la`} className={inputClass} value={prefs.lookaheadHours} onChange={(e) => update({ lookaheadHours: Number(e.target.value) as AlertPrefs['lookaheadHours'] })}>
                {[6, 12, 24].map((n) => (
                  <option key={n} value={n}>
                    {t('window.hours', { n })}
                  </option>
                ))}
              </select>
            </Field>
            <div className="border-t border-line pt-4">
              <div className="text-sm font-semibold text-fg">{t('alerts.browser')}</div>
              <p className="mt-1 text-xs text-muted">{t('alerts.browserHelp')}</p>
              <p className="mt-2 text-sm text-fg">{t(`alerts.perm.${perm}`)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {perm === 'default' && (
                  <Button variant="primary" onClick={enableBrowser}>
                    {t('alerts.browserEnable')}
                  </Button>
                )}
                {perm === 'granted' && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-fg">
                      <input type="checkbox" className="h-4 w-4 accent-[#5cc8e8]" checked={prefs.browserNotifications} onChange={(e) => update({ browserNotifications: e.target.checked })} />
                      {prefs.browserNotifications ? t('common.on') : t('common.off')}
                    </label>
                    <Button
                      onClick={() => {
                        const ok = showBrowserNotification(t('alerts.testTitle'), t('alerts.testBody'), 'ct-test');
                        setTestMsg(ok ? t('alerts.testShown') : t('alerts.perm.denied'));
                      }}
                    >
                      {t('alerts.test')}
                    </Button>
                  </>
                )}
              </div>
              {testMsg && <p className="mt-2 text-xs text-muted" role="status">{testMsg}</p>}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title={t('alerts.history')}>
        {alerts.history.length === 0 ? (
          <p className="text-sm text-muted">{t('alerts.historyEmpty')}</p>
        ) : (
          <ul className="num flex flex-col gap-1 text-sm">
            {alerts.history.slice(0, 8).map((h) => (
              <li key={`${h.id}-${h.announcedAt}`} className="flex flex-wrap items-center gap-2 text-muted">
                <CategoryBadge category={h.peakCategory} size="sm" />
                <span>
                  {formatHour(h.startTime, tz)} – {formatHour(h.endTime, tz)}
                </span>
                <span className="text-faint">({formatClock(Math.floor(h.announcedAt / 1000), tz)})</span>
                {h.simulatedData && <span className="text-xs text-accent">{t('alerts.demoTag')}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section className="flex flex-col gap-4" aria-labelledby="guidance-title">
        <div>
          <h2 id="guidance-title" className="text-xl font-semibold text-fg">
            {t('guidance.title')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('guidance.sources')} {t('guidance.notMedical')}
          </p>
        </div>
        {current && (
          <Notice tone="info">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="font-semibold text-fg">{t('guidance.now', { category: t(`cat.${current.category}`) })}</strong>
              {t(`guide.${current.category}`)}
            </span>
          </Notice>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <GuidanceList title={t('guidance.general')} keys={['guidance.g1', 'guidance.g2', 'guidance.g3', 'guidance.g4', 'guidance.g5', 'guidance.g6']} />
          <GuidanceList title={t('guidance.workers')} keys={['guidance.w1', 'guidance.w2', 'guidance.w3', 'guidance.w4']} />
          <GuidanceList title={t('guidance.older')} keys={['guidance.o1', 'guidance.o2', 'guidance.o3', 'guidance.o4']} />
        </div>

        <h3 className="mt-2 text-lg font-semibold text-fg">{t('guidance.signs')}</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={t('guidance.exhaustion')}>
            <ul className="list-disc space-y-1 ps-5 text-sm text-fg">
              <li>{t('guidance.e1')}</li>
              <li>{t('guidance.e2')}</li>
            </ul>
            <p className="mt-3 text-sm text-fg">{t('guidance.eAction')}</p>
          </Panel>
          <section className="rounded-xl border-2 border-alert/70 bg-alert/10 p-4 sm:p-5" aria-label={t('guidance.stroke')}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-fg">
              <TriangleAlert size={18} aria-hidden className="text-alert" />
              {t('guidance.stroke')}
            </h2>
            <ul className="list-disc space-y-1 ps-5 text-sm text-fg">
              <li>{t('guidance.s1')}</li>
              <li>{t('guidance.s2')}</li>
            </ul>
            <p className="mt-3 text-sm font-semibold text-fg">{t('guidance.sAction')}</p>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={t('guidance.emergency')}>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-3">
                <Phone size={16} aria-hidden className="text-accent" />
                <a href="tel:1122" className="num text-lg font-semibold">
                  1122
                </a>
                <span className="text-muted">{t('guidance.call1122')}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} aria-hidden className="text-accent" />
                <a href="tel:115" className="num text-lg font-semibold">
                  115
                </a>
                <span className="text-muted">{t('guidance.call115')}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-faint">{t('guidance.verifyNumbers')}</p>
          </Panel>
          <Panel title={t('guidance.official')}>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <a href="https://www.pmd.gov.pk/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                  {t('guidance.pmd')} <ExternalLink size={13} aria-hidden />
                </a>
              </li>
              <li>
                <a href="https://www.ndma.gov.pk/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                  {t('guidance.ndma')} <ExternalLink size={13} aria-hidden />
                </a>
              </li>
            </ul>
            <p className="mt-3 text-xs text-faint">
              Guidance sources:{' '}
              <a href="https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health" target="_blank" rel="noreferrer">
                WHO
              </a>
              ,{' '}
              <a href="https://www.cdc.gov/extreme-heat/signs-symptoms/index.html" target="_blank" rel="noreferrer">
                CDC
              </a>
              ,{' '}
              <a href="https://www.osha.gov/heat-exposure" target="_blank" rel="noreferrer">
                OSHA
              </a>
              .
            </p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
