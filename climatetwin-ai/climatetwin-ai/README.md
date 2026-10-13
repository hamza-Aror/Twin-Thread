# ClimateTwin AI

Heatwave Safety Intelligence System: CL-02 hackathon project by team **Twin Thread**.

ClimateTwin AI turns a live weather forecast into a documented heat-risk assessment for the next 24 hours. It then uses that one assessment to power the outlook, explanations, a Safe Window Finder, a What-If Simulator, alerts, and a community resource map, in English, Urdu and Sindhi.

> **Prototype.** This is not an official heat warning service and not medical advice. Follow warnings from the Pakistan Meteorological Department (PMD) and NDMA/PDMA.

---

## 1. What you need

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20.19 or newer (22 LTS recommended) | `node -v` |
| npm | comes with Node | `npm -v` |
| A modern browser | Chrome, Edge or Firefox | |

If `node -v` fails or shows an older version, install the **LTS** version from https://nodejs.org. Then close and reopen your terminal.

## 2. Run it (first time)

1. Unzip `climatetwin-ai.zip`, for example into `Documents\climatetwin-ai`.
2. Open a terminal **in that folder**:
   - **Windows:** open the folder in File Explorer, click the address bar, type `cmd`, and press Enter.
   - **VS Code:** use *File → Open Folder*, then *Terminal → New Terminal*.
3. Install the dependencies (one time; needs internet; takes 1–3 minutes):
   ```bash
   npm install
   ```
   Expect `added ### packages`. Warnings (`npm warn …`) are normal; errors (`npm error …`) are not.
4. Start the development server:
   ```bash
   npm run dev
   ```
   Expect `VITE v7.x ready` and `Local: http://localhost:5173/`.
5. Open **http://localhost:5173** in your browser. Keep the terminal open; press `Ctrl + C` in it to stop the server.

To restart later, open a terminal in the same folder and run `npm run dev` again. You do not need to run `npm install` again.

### Environment variables

None. Open-Meteo's free forecast API needs no key, and there are no secrets in this project.

## 3. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload at http://localhost:5173 |
| `npm test` | Runs all unit and component tests once (Vitest) |
| `npm run typecheck` | Strict TypeScript check, with no output files |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serves the production bundle at http://localhost:4173 |
| `npm run test:e2e` | Browser end-to-end tests (first run `npx playwright install chromium`) |

## 4. Demo mode and offline fallback

- Open **http://localhost:5173/?demo=1** to start directly with the labelled synthetic dataset.
- Alternatively, use **Use demo data** in the sidebar.
- If the live API fails, the app **does not** silently switch to demo data. It shows the error and offers last cached live data (labelled with its age) or an explicit button to continue with demo data.
- Demo data has a striped banner and a "Demo data (synthetic)" status everywhere.

## 5. How it works

```
Open-Meteo API ──► services/weather (fetch, timeout, validation, cache)
                        │  WeatherSnapshot (24 h, nulls for bad values)
                        ▼
              services/risk (ONE engine: NWS heat index + NWS bands)
                        │  HeatAssessment per hour
      ┌───────────┬─────┴──────┬──────────────┬───────────────┐
  Dashboard   Outlook chart  Safe Window    What-If         Alerts +
  + ribbon    + explanation  Finder         Simulator       notifications
```

| Folder | Contents |
|---|---|
| `src/services/weather/` | Open-Meteo client (`openMeteo.ts`), response validation (`normalize.ts`), cache |
| `src/services/risk/` | Heat index formula (`heatIndex.ts`), category bands (`categories.ts`), `assessHeat()`, elevated periods |
| `src/services/` | `safeWindow.ts`, `scenario.ts`, `alerts.ts`, `notifications.ts`, `resourceStore.ts`, `selfChecks.ts` |
| `src/data/` | Preset locations, synthetic demo weather, sample resources, NWS reference values |
| `src/i18n/` | English source strings, draft Urdu and Sindhi, translation function, RTL switching |
| `src/hooks/` | App state, weather loading, alert centre, hash router |
| `src/components/`, `src/pages/` | Interface |
| `src/tests/` | Unit and component tests. `e2e/` holds the Playwright browser tests |

### Risk methodology

- **Indicator:** the U.S. NWS Heat Index (Steadman simple formula, then the Rothfusz regression with the NWS low/high-humidity corrections). Inputs are air temperature and relative humidity only.
- **Categories:** NWS chart bands. Caution 80–90 °F, Extreme caution 90–103 °F, Danger 103–125 °F, Extreme danger ≥125 °F. Values are compared in °F with the lower bound inclusive.
- **Honesty rules:**
  - Missing or invalid inputs give "Not available", never a guess.
  - Values outside the NWS chart (RH < 40 % or T > 110 °F) are flagged as limited confidence.
  - The bands are labelled as U.S. reference bands, not PMD/NDMA criteria.

Full detail is on the in-app **Data and methodology** page.

## 6. Deploy (free static hosting)

The app is a static site. There is no server, database or environment variable.

**Netlify (drag and drop):**
1. Run `npm run build`.
2. Go to https://app.netlify.com/drop and drag the `dist` folder onto the page.
3. You get a public URL. Open it and check that live data loads before you announce it.

**Vercel:**
1. Push the folder to GitHub.
2. Import the repo at https://vercel.com/new. It detects Vite automatically (build `npm run build`, output `dist`).

Routing uses `#/page` hashes, so no rewrite rules are needed.

**Before deploying publicly:**
- The Open-Meteo free API is for **non-commercial** use; keep the attribution (shown on the methodology page).
- The OpenStreetMap tile servers require visible attribution (built into the map) and forbid heavy use. Fine for a demo; use a commercial tile provider for production.

## 7. Known limitations

- Heat-index bands are NWS references, not validated for Pakistan or endorsed by PMD/NDMA.
- The heat index assumes shade; direct sun can add up to about 8 °C. Personal factors are not modelled.
- Open-Meteo values are grid-cell model output, not street-level or station observations.
- Resource locations are **samples**; no verified cooling-centre dataset was available. User suggestions stay in the browser and are unverified.
- Urdu and Sindhi are **draft translations** awaiting native-speaker review, especially the warning-sign and emergency text.
- Browser notifications only appear while the page is open. There is no SMS, WhatsApp or push delivery.

See `docs/VERIFICATION.md` for exactly what has and has not been tested.
