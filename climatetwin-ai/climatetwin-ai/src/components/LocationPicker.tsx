import { useId, useState, type FormEvent } from 'react';
import { PRESET_LOCATIONS, makeCustomLocation, validateCoordinates } from '../data/locations';
import { useApp } from '../hooks/AppState';
import { useI18n } from '../i18n';
import { inputClass } from './ui';

/** Preset Pakistani cities or typed coordinates. Never asks for browser geolocation. */
export function LocationPicker() {
  const { t } = useI18n();
  const { location, setLocation } = useApp();
  const id = useId();
  const [showCustom, setShowCustom] = useState(Boolean(location.custom));
  const [lat, setLat] = useState(location.custom ? String(location.latitude) : '');
  const [lon, setLon] = useState(location.custom ? String(location.longitude) : '');
  const [error, setError] = useState<string | null>(null);

  const onSelect = (value: string) => {
    if (value === '__custom') {
      setShowCustom(true);
      return;
    }
    const preset = PRESET_LOCATIONS.find((p) => p.id === value);
    if (preset) {
      setShowCustom(false);
      setError(null);
      setLocation(preset);
    }
  };

  const onApply = (e: FormEvent) => {
    e.preventDefault();
    const la = Number.parseFloat(lat);
    const lo = Number.parseFloat(lon);
    const check = validateCoordinates(la, lo);
    if (!check.ok) {
      setError(t(`loc.err.${check.error ?? 'not_a_number'}`));
      return;
    }
    setError(null);
    setLocation(makeCustomLocation(la, lo));
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-sel`} className="text-xs text-muted">
        {t('loc.label')}
      </label>
      <select
        id={`${id}-sel`}
        className={inputClass}
        value={location.custom || showCustom ? '__custom' : location.id}
        onChange={(e) => onSelect(e.target.value)}
      >
        {PRESET_LOCATIONS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}, {p.region}
          </option>
        ))}
        <option value="__custom">{t('loc.custom')}</option>
      </select>
      {showCustom && (
        <form onSubmit={onApply} className="flex flex-col gap-2" noValidate>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-lat`} className="text-xs text-muted">
                {t('loc.lat')}
              </label>
              <input id={`${id}-lat`} className={inputClass} inputMode="decimal" type="number" step="0.01" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${id}-lon`} className="text-xs text-muted">
                {t('loc.lon')}
              </label>
              <input id={`${id}-lon`} className={inputClass} inputMode="decimal" type="number" step="0.01" value={lon} onChange={(e) => setLon(e.target.value)} />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-xs text-alert">
              {error}
            </p>
          )}
          <button type="submit" className="min-h-9 rounded-lg border border-line bg-raised px-3 text-sm text-fg hover:border-accent/60">
            {t('loc.apply')}
          </button>
          <p className="text-xs text-faint">{t('loc.privacy')}</p>
        </form>
      )}
    </div>
  );
}
