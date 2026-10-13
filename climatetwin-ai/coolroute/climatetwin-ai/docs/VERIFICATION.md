# Verification report: CoolRoute redesign

Checked on 13 October 2026 in a cloud sandbox where npm, the Open-Meteo APIs and OpenStreetMap tiles were **blocked by network policy**. The checks fall into three groups:

- **Verified here.** The check was actually run, and the results are below.
- **Verified with simulated API responses.** Playwright intercepted the app's requests to Open-Meteo and answered with responses in the documented API format: forecasts for Karachi, Hyderabad (PK and IN) and London, a deliberately slow city, a failing city, and a geocoder outage. This tests the app's real code paths, not real-world data.
- **Not yet verified.** Recharts, React Leaflet and Lucide could not be installed, so the in-sandbox build replaced them with labelled placeholders. The real chart, map tiles, markers and icons need your machine. See the last section.

## Results
| Check | Result |
|---|---|
| Unit tests: risk engine, weather and geocoding services, location sync, safe windows, simulator, alerts, explanations, translations, resources, theme preference | **99 / 99 pass** (run with Node's test runner using the same Vitest test files) |
| Strict TypeScript check (React types stubbed, so JSX props were not type-checked) | **0 errors** |
| Browser checks (headless Chromium, desktop 1440 px, tablet 820 px, phone 390 px, light and dark, English and Urdu) | **74 / 74 pass** |
| Component tests (`components.test.tsx`: language, theme toggle, badge, ribbon keyboard) | Not run here (need jsdom). Run `npm test` |
| Playwright e2e (`e2e/demo.spec.ts`) | Not run here. The equivalent checks are in the 74 above |

## Your redesign checklist
| Requirement | Status |
|---|---|
| Name is CoolRoute in title, header, metadata, notifications and docs; old name, tagline, team line and hackathon banner removed | Verified |
| Supplied logo used. Background removed and cropped, never stretched; favicon 16/32/48 px plus Apple touch icon | Verified (files load; rendered sizes checked) |
| Worldwide search: partial names, same-named cities with region and country, keyboard use, coordinates, empty / no-results / error / one-letter states | Verified with simulated responses |
| Selected city drives weather, risk, map and alerts together; no stale data under a new name (slow-response and failure cases) | Verified with simulated responses |
| Light by default, dark fully themed, saved across reloads, no flash on load | Verified |
| Header: logo, navigation, search, theme toggle, language, data status; clean on phone | Verified |
| "Overview" renamed to "Dashboard"; old `#/overview` and `#/explain` links still work | Verified |
| Live resource map on the Dashboard: filters, legend, details, honest sample labels, empty state, follows the city | Verified (list, details and filters; map tiles and markers not yet seen) |
| "Why this risk level" folded into the Dashboard as plain-language reasons, with "Learn how this is calculated" | Verified. Engine unchanged; all earlier engine tests still pass |
| Existing features (outlook, safe windows, simulator, alerts, map page, methodology, Urdu/Sindhi) still work | Verified |
| No horizontal scrolling on phone, tablet or desktop | Verified |

Bugs found and fixed during this round:
1. Temperatures in the Urdu/Sindhi "why" sentences displayed reversed.
2. A self-referencing CSS shadow token.
3. Some Urdu/Sindhi dashboard text was still in English.
4. The map left empty space beside the risk card.
5. The sidebar background stopped short on long pages.

## Please check on your computer
1. `npm install`, then `npm test`. Expect all tests to pass (99 unit + 4 component).
2. `npm run dev`, then open the printed address.
3. The status pill says **Live data**, and searching `Hyder` shows real results.
4. The **chart** on *Hourly outlook* draws in both themes.
5. The **map** shows street tiles, coloured dots and a blue centre dot. In dark mode the tiles appear dark. The zoom buttons follow the theme.
6. Icons appear in the sidebar and buttons (in the sandbox they were placeholder circles).
