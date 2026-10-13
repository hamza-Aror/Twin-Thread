# CoolRoute

Heat-risk outlook and cooling resources for any city. Built for **CL-02, Heatwave Safety Intelligence System**.

CoolRoute turns a live weather forecast into a documented heat-risk assessment for the next 24 hours. One assessment engine powers everything:
- a Dashboard with a live resource map and a plain-language "why this level";
- an hourly outlook;
- a Safe Window Finder;
- a What-If Simulator;
- alerts;
- English, Urdu and Sindhi, in light or dark mode.

> CoolRoute gives estimates from forecast data. It is not an official heat warning service or medical advice.

---

## 1. Run it in VS Code

**You need:** Node.js 20.19 or newer (22 LTS recommended). Check by typing `node -v` in a terminal. If that fails, install the **LTS** version from https://nodejs.org, then close and reopen VS Code.

1. Unzip `coolroute.zip`. You get a folder called `climatetwin-ai` (the original project folder name is kept).
2. In VS Code: **File → Open Folder…** and choose that `climatetwin-ai` folder (the one that contains `package.json`).
3. Open a terminal inside VS Code: **Terminal → New Terminal**. It opens in the project folder automatically.
4. Install the libraries (first time only, needs internet, about 1–3 minutes):
   ```bash
   npm install
   ```
   Lines starting with `npm warn` are normal. Lines starting with `npm error` are not. If you see one, copy it and ask for help.
5. Start the app:
   ```bash
   npm run dev
   ```
   Wait for output like:
   ```
     VITE v7.x.x  ready in 500 ms
     ➜  Local:   http://localhost:5173/
   ```
6. Hold **Ctrl** (Windows) or **Cmd** (Mac) and click the `http://localhost:…` link, or type it into your browser. Use the exact address the terminal prints. If port 5173 is busy, Vite picks 5174 and so on.
7. To stop the app, click in the terminal and press **Ctrl + C**.

**If you already had the old version running:** stop it with **Ctrl + C**, replace the folder with this version, then run `npm install` and `npm run dev` again. Restarting is needed because the page template, icons and styles changed. No new libraries were added, but `npm install` is harmless and makes sure everything matches.

**Next time:** open the folder, open a terminal, and run `npm run dev`.

There are no environment variables or API keys. Open-Meteo's forecast and geocoding APIs are free for non-commercial use without a key.

## 2. What to try

| Feature | How to check it |
|---|---|
| **City search (any city)** | Click the search box at the top. Type `Hyder`: you'll see Hyderabad in India *and* Pakistan, each with its region and country. Pick one with the mouse, or with ↓ and Enter. The heading, weather cards, risk summary, map and alerts all switch to that city. Also try `London`, `São Paulo`, a typo like `zzzz` (clear "no places found" message), or coordinates like `24.86, 67.01`. |
| **Light / dark mode** | Use the moon/sun button at the top right. Light is the default on a first visit. Your choice is remembered after a reload. |
| **Logo and favicon** | The CoolRoute logo is at the top of the sidebar (or the header on phones), and the icon shows in the browser tab. |
| **Dashboard** | The landing page shows the city name, four condition cards, the live map beside "Heat risk now", alerts, the 24-hour ribbon and the daily forecast. |
| **Why this level** | Inside "Heat risk now". Plain-language reasons come first; **Learn how this is calculated** opens the formula details. |
| **Map places (real data)** | The Dashboard map and *Resource map* load **real OpenStreetMap places** near the selected city: mapped drinking water, parks, and hotels (as *possible* indoor options). Click one for details, its map tags and a link to it on OpenStreetMap. Water tagged as not drinkable, private or disused is left out. No official cooling-centre list exists, and the legend says so. |
| **Official heatwave criteria** | The card under "Heat risk now". Karachi uses the Karachi Heatwave Management Plan; Punjab cities (e.g. Lahore, Multan) use PMD RMC Punjab's thresholds. Other places honestly show "no published criteria". The card is always labelled a **rule-based estimate**, not a live PMD alert. |
| **Phone layout** | In Chrome press **F12**, then the phone/tablet icon (Toggle device toolbar), and pick e.g. *iPhone 12 Pro*. The search moves to its own row and the menu button opens navigation. |

**Offline backup for a demo:** open `http://localhost:5173/?demo=1`. It uses clearly labelled synthetic weather and **demo places** (marked "Demo"), and makes no OpenStreetMap requests. The map tiles, city search and web fonts still need internet.

## 3. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload |
| `npm test` | Unit and component tests (Vitest) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Production bundle in `dist/` |
| `npm run preview` | Serves the production bundle at http://localhost:4173 |
| `npm run test:e2e` | Browser tests. Run `npx playwright install chromium` once first |

## 4. How it works

```
Search box ──► Open-Meteo Geocoding (any city) ──► selected location
                                                       │
Open-Meteo Forecast ──► validate + normalise ──► WeatherSnapshot (only shown if it matches the selected location)
                                                       │
                          ONE risk engine: NWS heat index + NWS category bands
        ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
    Dashboard      Hourly outlook  Safe windows   Simulator       Alerts      Resource map
```

| Folder | Contents |
|---|---|
| `src/services/weather/` | Forecast client, geocoding client, response validation, cache, location sync |
| `src/services/risk/` | Heat index formula, category bands, assessment, plain-language explanation |
| `src/services/official/` | Published Pakistani heatwave criteria (Karachi plan, PMD RMC Punjab): framework selection and evaluation |
| `src/services/places/` | OpenStreetMap places via Overpass: query, conservative classification, de-duplication, cache, errors |
| `src/theme/` + `src/index.css` | Light/dark design tokens and the theme switch |
| `src/components/`, `src/pages/` | Interface (Dashboard, map, search, outlook, simulator…) |
| `src/i18n/` | English, plus draft Urdu and Sindhi |
| `public/`, `assets/brand/` | Logo, favicons, and your original logo file |
| `src/tests/`, `e2e/` | Unit/component tests and browser tests |

**Two separate things, never mixed:**
- **CoolRoute heat risk** (the app's own estimate): NWS heat index from temperature + humidity. That is why "Caution" can appear around 32 °C. For example, 32 °C at 30% humidity has a heat index of 30.8 °C (Caution band 27–32 °C).
- **Official heatwave criteria** (`src/services/official/heatwaveFrameworks.ts`): PMD's published thresholds use forecast daily max/min **air temperature** only. They are applied only where a verified framework covers the place (Karachi plan, RMC Punjab), and labelled a rule-based estimate because no live PMD feed is integrated.

**Risk method:**
- **Indicator:** the U.S. NWS heat index (temperature + humidity).
- **Categories:** NWS chart bands (Caution 27–32 °C, Extreme caution 32–39 °C, Danger 39–52 °C, Extreme danger ≥ 52 °C heat index).
- **When data is missing:** the app shows "Not available" rather than a guess.
- **Limitations:** these bands are U.S. references, not PMD/NDMA criteria. Full detail is in the app's *Data and methodology* page.

## 5. Deploy (free static hosting)

1. Run `npm run build`.
2. Either:
   - drag the `dist` folder onto https://app.netlify.com/drop, or
   - push the project to GitHub and import it at https://vercel.com/new (it detects Vite automatically).

There's no server or secret to configure. Keep the Open-Meteo and OpenStreetMap attributions (already in the footer and map).

## 6. Known limitations

- **Map places:** they come from OpenStreetMap volunteers. Coverage varies, and CoolRoute does not check whether a mapped water point works or is safe, or whether a hotel will let people in. No official cooling-centre source is integrated. Overpass is a free shared service: it can be slow or rate-limited, and the app then shows an error with *Try again*.
- **Official criteria:** these are rule-based estimates from published criteria applied to Open-Meteo's forecast, not live PMD alerts, and only for Karachi and Punjab. The Karachi plan uses Jinnah International Airport temperatures. The Karachi city boundary is approximated as 35 km from the centre.
- **Heat index assumes shade:** direct sun, workload, age and health change real risk.
- **Forecast resolution:** values are model output for a grid cell, not station readings.
- **City search:** finds places by name, using Open-Meteo's GeoNames-based index. "Name, Country" works by ranking matches; very small places may be missing.
- **Translations:** Urdu and Sindhi are drafts awaiting native-speaker review.
- **Notifications:** browser notifications work only while the page is open. There is no SMS or WhatsApp.

See `docs/VERIFICATION.md` for exactly what was and wasn't tested.
