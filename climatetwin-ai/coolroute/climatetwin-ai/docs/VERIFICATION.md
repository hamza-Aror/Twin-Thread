# Verification report: official heatwave criteria and OpenStreetMap places

Checked on 14 October 2026 in a cloud sandbox where npm, Open-Meteo, Overpass and OpenStreetMap tiles were **blocked by network policy**. The official sources themselves *were* read, through a web-reading tool.

## Sources verified for the official criteria
| Source | What it gives | Used? |
|---|---|---|
| [PMD RMC Punjab heatwave update](https://rmc-punjab.pmd.gov.pk/heatwave-update) | Normal Day < 40 °C; Hot Day Alert 40–41.9 °C; Hot Day Warning ≥ 42 °C; Heatwave Emergency ≥ 42 °C and minimum ≥ 30 °C for 2+ consecutive days, plus significant heat illness/mortality reports. Scope: Punjab. | Yes, for Punjab only |
| [Karachi Heatwave Management Plan (2017)](https://docc.sindh.gov.pk/files/DoCC/Documents/Karachi%20Heatwave%20Management%20Plan.pdf) | Yellow 40–41.9 °C; Orange ≥ 42 °C; Red ≥ 42 °C and minimum ≥ 30 °C for 2+ days (rising illness or deaths can also trigger it). Jinnah International Airport. Scope: Karachi city. | Yes, for Karachi only |
| [NDMA guidelines page](https://www.ndma.gov.pk/guidelines), including the 2026 Heatwave Guidelines | No numeric thresholds or levels | No (nothing to apply) |
| PDMA Sindh heatwave alert, May 2025 | Forecast anomalies only; no defined levels | No |
| [WHO heat-health warning guidance](https://www.who.int/publications/m/item/heatwaves-and-health--guidance-on-warning-system-development) | General guidance on designing warning systems | Background only |

## What was run and the results
| Check | Command / method | Result |
|---|---|---|
| Unit tests (incl. 20 official-criteria tests and 16 OpenStreetMap tests) | Same Vitest test files, run with Node's test runner through a small compatibility shim | **135 / 135 pass** |
| Strict TypeScript | `tsc` with stubbed React/library types (JSX props not type-checked) | **0 errors** |
| Browser checks: desktop, tablet, phone; light/dark; English/Urdu | Headless Chromium on an esbuild bundle. Open-Meteo, geocoding and Overpass answered with **simulated responses in their documented formats** | **100 / 100 pass** |
| `npm test`, `npm run build`, `npm run test:e2e` | Not possible here: npm packages can't be installed | **Not run.** Please run them |

Highlights of the browser checks (all with simulated responses):
- Real-format OpenStreetMap places are listed. Water tagged `drinking_water=no` and disused water are excluded, and a park mapped twice is merged into one entry (counts: water 2, parks 1, hotels 1).
- Hotels show the "not a public cooling centre; AC/entry/fees unverified" caveat and link to their OpenStreetMap object. The legend says "Official cooling centres: none available".
- **Karachi:** Karachi plan applies, and below 40 °C it shows "No alert level".
- **Lahore:** RMC Punjab applies. A forecast at or above 42 °C shows Hot Day Warning; Heatwave Emergency is *not* shown from temperature, and the health-report note appears.
- **Hyderabad (Sindh):** "no published criteria" message; the Punjab thresholds are not applied.
- **London:** "not applicable outside Pakistan", and an honest empty state for places.
- **Overpass rate-limited on both servers:** a clear error appears, the fallback server is tried, the rest of the app keeps working, and *Try again* loads the places.
- **Requests:** typing in the search sends no map-data requests, and returning to a cached city sends none.
- **Demo mode:** shows only "Demo" places and makes no Overpass request.

Bugs found and fixed during these checks:
- Urdu and Sindhi "no places found" messages had dropped the search radii.
- The official-level badges rendered without colour (fragile class names); they now use inline colours.

## Please check on your computer
1. `npm install`, then `npm test`. Expect all to pass.
2. `npm run build`. Expect "✓ built" with no errors.
3. `npm run dev`, open Karachi, and wait a few seconds: real dots should appear on the map. Click a water point, then **View on OpenStreetMap** to confirm the object exists.
4. Search **Lahore** and check the "Official heatwave criteria" card. Compare it with today's bulletin at https://rmc-punjab.pmd.gov.pk/heatwave-update. The PMD forecast may differ from Open-Meteo's.
5. Optional: `npx playwright install chromium`, then `npm run test:e2e`.
