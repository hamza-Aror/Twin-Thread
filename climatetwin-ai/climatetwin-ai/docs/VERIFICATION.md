# Verification report

Built and checked on 13 Oct 2026 in a cloud sandbox whose network was locked by policy. npm, the Open-Meteo API and map tiles were all unreachable there, so checks fall into three groups:

- **Verified here:** actually run, results below.
- **Verified here with stand-ins:** the app was bundled with esbuild and run in headless Chromium, but Recharts, React Leaflet and Lucide icons were replaced by labelled placeholders because they couldn't be installed. Everything else was the real code.
- **Not yet verified:** needs your machine with internet. Run the commands in the last column.

## Automated results from the sandbox
| Check | Result |
|---|---|
| Unit tests (risk engine, weather service, decision logic, i18n, resources), run with Node's test runner through a Vitest-compatible shim | **76 / 76 pass** |
| Strict TypeScript check, TS 6.0 (React types stubbed, so JSX props were not type-checked) | **0 errors** |
| Headless browser checks (demo mode plus live-failure path, desktop and mobile, Urdu and Sindhi) | **52 / 52 pass** |
| Component tests (`components.test.tsx`, needs jsdom) | Not run in sandbox |
| Playwright e2e (`e2e/demo.spec.ts`) | Not run in sandbox (equivalent checks are in the 52 above) |

Bugs found and fixed during verification:
1. React StrictMode stole focus on load, so the skip link wasn't reachable by keyboard.
2. Ribbon dimming was overridden by the entrance animation.
3. Numbers and times were bidi-reordered in Urdu and Sindhi ("C° 40.7", "PM 1").
4. Some alert-settings labels were untranslated in Sindhi.
5. Two tests had wrong expected values at category boundaries.

## The 17 acceptance criteria

| # | Criterion | Status | How it was checked / how to check |
|---|---|---|---|
| 1 | App starts | Partly verified | The bundle starts in the browser. **You:** `npm run dev`. |
| 2 | No critical console errors | Verified here with stand-ins | 0 page errors across all pages. **You:** open DevTools → Console. |
| 3 | Live weather loads from the real API | **Not yet verified** | API blocked in sandbox; the client is unit-tested with fixtures in the documented response shape. **You:** status pill should say *Live data*; methodology page should show "1 ok". |
| 4 | API failure gives an honest fallback | Verified here | Real blocked request shows the error screen; no silent demo; explicit demo button; request log shows the failure. |
| 5 | Consistent, documented risk results | Verified here | 8/8 NWS reference values within 0.9 °F; deterministic; one engine for all screens. |
| 6 | Missing/invalid inputs aren't misleading | Verified here | Unit tests: unavailable category, no value, notes. |
| 7 | Elevated periods highlighted | Verified here (ribbon, list); chart **not yet verified** | Chart shading uses Recharts. **You:** shaded bands on the outlook chart. |
| 8 | Safe Window Finder ranks by rules | Verified here | Unit tests, plus browser check of best window, reasons, fixed start and infeasible ranges. |
| 9 | Scenario changes recalculate | Verified here | Unit tests, plus browser check (+2 °C, wind-only, humidity overflow rejected). |
| 10 | Map markers and details work | List and details verified here; **markers not yet verified** | **You:** markers appear around the city and clicking one opens details. |
| 11 | Unverified samples labelled | Verified here | Every sample shows "Sample entry, not a real facility". |
| 12 | Language switching including Urdu RTL | Verified here | `dir=rtl` set, navigation translated, ribbon stays LTR, numbers isolated. Fonts in the sandbox were fallbacks. |
| 13 | Notification permissions | Verified here (simulated granted path) | Permission requested only on button press; test notification sent; alerts announced once across reloads. Headless Chromium reports `denied`, and the app displays that state correctly. **You:** allow notifications once in a real browser. |
| 14 | Desktop and mobile layout | Verified here | 1440×900 and 390×844, no horizontal overflow. |
| 15 | Keyboard navigation | Verified here | Skip link is the first Tab stop; ribbon arrow, Home and End keys work. |
| 16 | Documented tests run | Partly verified | **You:** `npm test` should report 79 passing (76 unit + 3 component). |
| 17 | Restart from written instructions | Not yet verified | **You:** follow README §2. |

## Package versions
`package.json` uses version ranges chosen for compatibility (Vite 7, React 19, Tailwind 4, Recharts 3, React Leaflet 5, Vitest 3). They could not be resolved against the npm registry from the sandbox. If `npm install` reports a peer-dependency conflict, run `npm install --legacy-peer-deps` and report the message so the ranges can be adjusted.
