import { useMemo, type ReactNode } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { PageHeader, Panel } from '../components/ui';
import { CATEGORY_INK, CATEGORY_RULES, CATEGORY_SOURCE, DEFAULT_ELEVATED_CATEGORY } from '../services/risk/categories';
import { fToC } from '../services/risk/heatIndex';
import { OPEN_METEO_ENDPOINT } from '../services/weather/openMeteo';
import { GEOCODING_ENDPOINT, describeLocation } from '../services/weather/geocoding';
import { STALE_AFTER_MS } from '../services/weather/cache';
import { boundaryChecks, referenceChecks, scenarioChecks, type CheckResult } from '../services/selfChecks';
import { formatClock, formatDateTime, minutesSince } from '../utils/format';

function Checks({ title, results }: { title: string; results: CheckResult[] }) {
  const { t } = useI18n();
  const passed = results.filter((r) => r.pass).length;
  return (
    <div>
      <h3 className="flex items-baseline justify-between text-sm font-semibold text-fg">
        {title}
        <span className={`num text-xs ${passed === results.length ? 'text-teal' : 'text-alert'}`}>
          {passed}/{results.length} {t('eval.pass').toLowerCase()}
        </span>
      </h3>
      <ul className="num mt-2 flex flex-col gap-1 text-xs">
        {results.map((r) => (
          <li key={r.name} className="flex items-start gap-2">
            {r.pass ? <CircleCheck size={14} className="mt-0.5 shrink-0 text-teal" aria-label={t('eval.pass')} /> : <CircleX size={14} className="mt-0.5 shrink-0 text-alert" aria-label={t('eval.fail')} />}
            <span className="text-fg">{r.name}</span>
            <span className="text-faint">{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <>
    <dt className="text-muted">{k}</dt>
    <dd className="min-w-0 break-words text-fg">{v}</dd>
  </>
);

export function MethodPage() {
  const { t } = useI18n();
  const { weather, location } = useApp();
  const snap = weather.snapshot;
  const checks = useMemo(() => ({ ref: referenceChecks(), bounds: boundaryChecks(), scen: scenarioChecks() }), []);
  const okCount = weather.requestLog.filter((r) => r.ok).length;

  const modeLabel = snap ? t(`status.${snap.source}`) : t('status.error');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('method.title')} />

      <Panel title={t('method.freshness')}>
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-2 text-sm">
          <Row k={t('method.mode')} v={modeLabel} />
          <Row
            k={t('method.provider')}
            v={
              snap?.source === 'demo' ? (
                'Synthetic demo generator (src/data/demoWeather.ts)'
              ) : (
                <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                  Open-Meteo forecast API
                </a>
              )
            }
          />
          <Row k={t('method.endpoint')} v={<span className="num text-xs break-all">{OPEN_METEO_ENDPOINT}</span>} />
          <Row k="Place search" v={<span className="num text-xs break-all">{GEOCODING_ENDPOINT}</span>} />
          <Row k={t('method.location')} v={describeLocation(location)} />
          <Row k={t('method.coords')} v={<span className="num">{`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}</span>} />
          <Row k={t('method.timezone')} v={snap?.timezone ?? '—'} />
          <Row
            k={t('method.fetched')}
            v={snap ? <span className="num">{`${formatDateTime(Math.floor(snap.fetchedAt / 1000), snap.timezone)} (${t('status.minutesAgo', { n: minutesSince(snap.fetchedAt) })})`}</span> : '—'}
          />
          <Row k={t('method.modelTime')} v={snap ? <span className="num">{formatDateTime(snap.current.time, snap.timezone)}</span> : '—'} />
          <Row
            k={t('method.validation')}
            v={
              snap
                ? t('method.validationLine', { accepted: snap.validation.hourlyAccepted, received: snap.validation.hourlyReceived, rejected: snap.validation.valuesRejected })
                : '—'
            }
          />
        </dl>
        {snap && snap.validation.issues.length > 0 && (
          <ul className="mt-2 list-disc ps-5 text-xs text-faint">
            {snap.validation.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-faint">
          Data older than {STALE_AFTER_MS / 60000} minutes is flagged as possibly out of date. The app refreshes every 30 minutes while the tab is visible. Current
          conditions are Open-Meteo model values for the grid cell, not a weather-station observation; hourly values are forecasts.
        </p>
      </Panel>

      <Panel title={t('method.engine')}>
        <div className="flex flex-col gap-4 text-sm text-fg">
          <div>
            <h3 className="font-semibold">Phase A: environmental indicator</h3>
            <p className="mt-1 text-muted">
              The NWS heat index combines air temperature and relative humidity to estimate how hot it feels in the shade. It uses Steadman&apos;s simple formula when the
              result is below 80 °F and the Rothfusz regression (with the two NWS corrections) otherwise. Inputs outside −60 to 60 °C or 0–100 % are rejected and the hour is
              marked unavailable. Values outside the NWS chart (humidity below 40 % or temperature above 110 °F) are computed but flagged as limited confidence. Wind and
              solar radiation are not inputs; the interface says so wherever it matters.
            </p>
            <p className="mt-1 text-xs">
              <a href="https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml" target="_blank" rel="noreferrer">
                NWS: The Heat Index Equation
              </a>
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Phase B: category bands</h3>
            <div className="mt-2 overflow-x-auto" dir="ltr">
              <table className="num w-full min-w-[420px] text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 pe-4 font-medium">Category</th>
                    <th className="py-1 pe-4 font-medium">Heat index (°F)</th>
                    <th className="py-1 font-medium">Heat index (°C)</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_RULES.map((r) => (
                    <tr key={r.category} className="border-t border-line">
                      <td className="py-1.5 pe-4" style={{ color: CATEGORY_INK[r.category] }}>
                        {t(`cat.${r.category}`)}
                      </td>
                      <td className="py-1.5 pe-4">{r.minF === null ? `< ${r.maxF}` : r.maxF === null ? `≥ ${r.minF}` : `${r.minF} to < ${r.maxF}`}</td>
                      <td className="py-1.5">
                        {r.minF === null ? `< ${fToC(r.maxF as number).toFixed(1)}` : r.maxF === null ? `≥ ${fToC(r.minF).toFixed(1)}` : `${fToC(r.minF).toFixed(1)} to < ${fToC(r.maxF).toFixed(1)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-muted">
              Bands follow the{' '}
              <a href={CATEGORY_SOURCE.url} target="_blank" rel="noreferrer">
                {CATEGORY_SOURCE.name}
              </a>{' '}
              and are configured in <code className="text-xs">src/services/risk/categories.ts</code>. They are U.S. reference bands used for this prototype, not Pakistan
              Meteorological Department or NDMA warning criteria. Hours at “{t(`cat.${DEFAULT_ELEVATED_CATEGORY}`)}” or above are highlighted as elevated.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Safe window finder, simulator and alerts</h3>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-muted">
              <li>
                Safe windows: every contiguous window of the chosen length inside the preferred range is assessed; windows with any unavailable hour are excluded. Ranking is
                lexicographic (highest category, hours at that category, peak heat index, mean heat index, peak UV for outdoor activities, then start time). Code:{' '}
                <code className="text-xs">src/services/safeWindow.ts</code>.
              </li>
              <li>
                Simulator: adjustments are applied to one forecast hour, validated, and passed through the same <code className="text-xs">assessHeat</code> function. Invalid
                results are rejected, never clamped.
              </li>
              <li>
                Alerts: one alert per contiguous period reaching the chosen category within the look-ahead; an id of location, start and peak category prevents repeats.
              </li>
            </ul>
          </div>
        </div>
      </Panel>

      <Panel title={t('eval.title')}>
        <p className="mb-4 text-sm text-muted">{t('eval.intro')}</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="flex items-baseline justify-between text-sm font-semibold text-fg">
              {t('eval.requests')}
              <span className="num text-xs text-faint">
                {okCount} ok, {weather.requestLog.length - okCount} failed
              </span>
            </h3>
            {weather.requestLog.length === 0 ? (
              <p className="mt-2 text-xs text-muted">{t('eval.noRequests')}</p>
            ) : (
              <ul className="num mt-2 flex flex-col gap-1 text-xs">
                {weather.requestLog.map((r) => (
                  <li key={r.at} className="flex items-start gap-2">
                    {r.ok ? <CircleCheck size={14} className="mt-0.5 shrink-0 text-teal" aria-hidden /> : <CircleX size={14} className="mt-0.5 shrink-0 text-alert" aria-hidden />}
                    <span className="text-fg">{formatClock(Math.floor(r.at / 1000), snap?.timezone ?? 'UTC')}</span>
                    <span className="text-muted">
                      {r.locationName}, {r.durationMs} ms
                    </span>
                    <span className="min-w-0 break-words text-faint">{r.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <Checks title={t('eval.boundaries')} results={checks.bounds} />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <Checks title={t('eval.reference')} results={checks.ref} />
            <Checks title={t('eval.scenario')} results={checks.scen} />
            <div>
              <h3 className="text-sm font-semibold text-fg">{t('eval.unitTests')}</h3>
              <p className="mt-1 text-xs text-muted">{t('eval.unitTestsBody')}</p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('method.limitations')}>
          <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted">
            <li>Not an official warning service. Thresholds are NWS reference bands, not PMD/NDMA criteria, and have not been validated for Pakistan.</li>
            <li>The heat index assumes shade and light wind. Direct sun, heavy work, clothing, age, health and medication change real risk.</li>
            <li>Open-Meteo values are model output for a grid cell (several km), not street-level readings. Urban heat islands and indoor heat are not captured.</li>
            <li>Very dry or very hot conditions fall outside the NWS chart; those values are flagged as limited confidence.</li>
            <li>Resource locations are samples (near the suggested Pakistani cities only) or unverified local reports. No verified cooling-centre dataset was available, so most searched cities show no listed resources.</li>
            <li>City search finds places by name only, using Open-Meteo's GeoNames-based index; very small places may be missing.</li>
            <li>Urdu and Sindhi translations are drafts awaiting native-speaker review.</li>
            <li>Browser notifications only work while the page is open. There is no SMS, WhatsApp or push delivery.</li>
          </ul>
        </Panel>
        <Panel title={t('method.privacy')}>
          <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted">
            <li>No account, no health data and no browser location permission are requested.</li>
            <li>Only the chosen coordinates (rounded to two decimals for typed coordinates) are sent to Open-Meteo to get the forecast.</li>
            <li>Text typed into the city search is sent to the Open-Meteo geocoding service to find matching places.</li>
            <li>Preferences, the last forecast, alert history and resource reports stay in this browser&apos;s local storage. Clearing site data removes them.</li>
            <li>Map tiles are requested from OpenStreetMap servers, which see the viewed map area.</li>
          </ul>
          <h3 className="mt-4 text-sm font-semibold text-fg">{t('method.attribution')}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted">
            <li>
              Weather data and place search by{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo.com
              </a>{' '}
              (CC BY 4.0; free tier for non-commercial use, see{' '}
              <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer">
                terms
              </a>
              ).
            </li>
            <li>
              Map data ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap contributors
              </a>{' '}
              (ODbL), tiles subject to the{' '}
              <a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noreferrer">
                OSMF tile usage policy
              </a>
              .
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
