# Technical Q&A guide

## Data and API

**How does city search work, and is it limited?**
There's no fixed city list. Typing calls the free Open-Meteo Geocoding API, which has a GeoNames-based index of places worldwide.
- One letter returns nothing. Two letters match exact names only. Three or more letters use fuzzy matching, so partial names like "Hyder" work.
- Same-named cities are shown with region and country.
- "Hyderabad, Pakistan" works by searching "Hyderabad" and ranking Pakistani results first, because the API only searches names.
- Coordinates such as "24.86, 67.01" are accepted directly.
- Requests are debounced (300 ms) and cancelled when you keep typing.
- Failures show an error, never invented results.

**How do you make sure the screen never mixes two cities?**
- Every weather snapshot carries the id of the location it was fetched for.
- The app only displays a snapshot whose id matches the selected location. Until the new city's data arrives, it shows "Loading weather for …".
- Late responses for a previous city are ignored (the request is aborted, and the id check catches any that slip through).
- This is unit-tested, and browser-tested with a deliberately slow response.

**Why does the app show "Caution" at about 32 °C when PMD only alerts from 40 °C?**
They measure different things.
- **CoolRoute's risk** is a heat-stress estimate from the NWS heat index (temperature + humidity). 32 °C at 30% humidity gives a heat index of 30.8 °C (Caution); at 50% humidity it is 34.4 °C (Extreme caution).
- **PMD's heatwave alerts** use forecast air temperature: Hot Day Alert from 40 °C, Hot Day Warning from 42 °C.

The app shows both, separately and clearly labelled.

**Which official criteria do you use, and where?**
Only frameworks we verified from the issuer's own publication, and only inside their stated scope:
- **Karachi Heatwave Management Plan (2017):** Karachi city.
- **PMD RMC Punjab heatwave thresholds:** Punjab province, matched by country and province, so India's Punjab is excluded.

NDMA's 2026 heatwave guidelines and PDMA Sindh alerts were checked; they contain no numeric thresholds. Everywhere else, the app says no published criteria are integrated. Results are always labelled a rule-based estimate, because no live PMD alert feed is integrated.

**How do you handle the Heatwave Emergency level?**
- **RMC Punjab:** its emergency also requires significant reports of heat illness and deaths, which we don't have. So we never show that level from temperature; we explain that the temperature part is met.
- **Karachi plan:** its Red level is defined by temperature persistence (≥ 42 °C with minimum ≥ 30 °C for 2+ days), so we show it, adding that only PMD and the Commissioner Karachi can declare an emergency.

**Where do the map places come from? Are they real?**
- **Source:** OpenStreetMap, via the free Overpass API, searched around the selected coordinates (water within 5 km, parks and hotels within 3 km).
- **Classification is conservative.** Drinking water requires explicit tags (amenity=drinking_water, drinking_water=yes, fountain=drinking). Points tagged not drinkable, private or disused are excluded. Parks are possible shaded rest areas, never cooling centres. Hotels are only possible indoor options: AC, entry, fees and hours are unverified.
- **No invented places:** "Official cooling centre" is never inferred, and no official list exists, so none are shown.
- **Requests:** results are cached for 12 hours, requests for the same place are shared, and a fallback server is used on rate limits.

**Where does the weather come from?**
The Open-Meteo forecast API (`api.open-meteo.com/v1/forecast`). We request current conditions, 24 hourly values (temperature, humidity, apparent temperature, wind, UV, rain probability, day/night) and daily highs/lows, with `timezone=auto` and Unix timestamps. Open-Meteo combines national weather models; it needs no key, and the free tier is for non-commercial use under CC BY 4.0.

**Is "current" an observation?**
No. It's Open-Meteo's model value for the grid cell, updated every 15 minutes. The interface says "model estimate, not a weather-station reading".

**What happens if the API fails or returns bad data?**
- Requests time out after 10 s.
- Errors are classified as timeout, network, HTTP, invalid response, or invalid location.
- Each value is range-checked: temperature −60 to 60 °C, humidity 0–100 %, and so on. Implausible values become `null`, are counted in a validation report, and are never clamped.
- If the request fails, the last successful live response (up to 6 h old) is shown labelled "cached" with its age. Demo data is used only if the user chooses it.

**How fresh is it?**
The app refreshes every 30 minutes while the tab is visible and flags data older than 60 minutes. Retrieval time and model time are on the methodology page.

## Indicator and categories

**Why the heat index?**
It's a documented, widely used indicator that needs only temperature and humidity, both of which the API provides reliably. We implemented the NWS algorithm exactly:
1. Steadman's simple formula.
2. If the average of that result and the temperature is ≥ 80 °F, the Rothfusz regression.
3. The NWS low- and high-humidity corrections.

**How accurate is your implementation?**
It reproduces eight NWS chart values to within 0.9 °F; the regression's own stated error is ±1.3 °F. The evaluation panel recomputes this live.

**Why not WBGT?**
WBGT is better for physical work in sun, but it needs solar radiation and globe-temperature inputs and a validated estimation method. Approximating it badly would be worse than using the heat index honestly. It's our first future improvement.

**Are your thresholds official?**
No. They are the NWS heat-index chart bands, cited and labelled as U.S. reference bands, not PMD or NDMA criteria. They live in one configurable file (`categories.ts`).

**Pakistan is often very dry and very hot. Does the formula hold?**
The NWS chart covers 80–110 °F and 40–100 % humidity. Outside that range we still compute the value but mark it **limited confidence** and say why. In dry heat, the heat index is close to the air temperature, which is itself dangerous; the guidance still applies.

**What about wind and sun?**
Neither is an input to the heat index. The heat index assumes shade and light wind; NWS notes full sun can add up to 15 °F (about 8 °C). The simulator lets you change wind, then explains why the category doesn't move.

## Algorithms

**How does the Safe Window Finder rank windows?**
1. It enumerates every contiguous window of the chosen length inside the preferred hours.
2. It drops any window with an unavailable hour.
3. It sorts the rest lexicographically by:
   1. highest category;
   2. hours at that category;
   3. peak heat index;
   4. mean heat index;
   5. peak UV (outdoor only);
   6. start time.

The first criterion that differs decides. Each lower window reports the exact criterion and both values. There is no weighted score.

**Why lexicographic and not a weighted score?**
A weighted score needs weights we can't justify without data. A lexicographic order matches the safety priority (avoid the worst category first), and any judge can check it by hand.

**How does the simulator avoid nonsense?**
- Adjustments are bounded.
- Results are validated before reaching the formula: humidity outside 0–100 % or negative wind is rejected with a reason.
- It calls the same `assessHeat` function as the forecast.
- A zero adjustment reproduces the forecast exactly; that's a test.

**How are alerts generated and de-duplicated?**
- Consecutive forecast hours at or above the user's threshold, within the look-ahead, form a period.
- An alert's id is location, period start and peak category. Each id is announced once and stored with a 48 h expiry.
- An escalation (a higher peak) creates a new id and is announced again.
- Demo-data alerts carry a separate id prefix and a "Demo data" tag.

## Testing and quality

**What is tested?**
79 automated tests:
- Formula against NWS values, monotonicity, invalid inputs.
- Every category boundary.
- Missing and invalid assessments.
- Elevated periods.
- API normalisation, timeouts, HTTP and network errors.
- Safe-window ranking, exclusions, wrap-around ranges and fixed starts.
- Simulator rules.
- Alert de-duplication.
- Translation coverage and placeholders.
- Resource validation.
- RTL switching and keyboard ribbon navigation (component tests).

Playwright end-to-end tests cover the demo walkthrough and the API-failure path. See `docs/VERIFICATION.md` for where each was run.

**Accessibility?**
- Semantic landmarks and a skip link.
- Focus moves to the page heading on navigation.
- Visible focus rings.
- The hour ribbon is a keyboard-operable button group (arrow keys, Home, End) with descriptive labels.
- The chart has a data-table alternative.
- Reduced motion is respected, and colour is never the only signal (category names are always shown).

**How does dark mode work?**
- There's one set of semantic design tokens (surface, text, border, accent, risk colours), each with a light and a dark value.
- Components only use the token names, so the whole interface, including the chart and the map controls, follows the theme.
- Light is the default for a first visit. The choice is saved in the browser, and a tiny script applies it before the first paint, so there's no flash.
- All text colours pass WCAG 4.5:1 contrast in both themes.
- The risk colours were checked with a colour-vision-deficiency validator so neighbouring categories stay distinguishable.

## Privacy and safety

**What data do you collect?**
None on a server; there is no server. Preferences, the last forecast, alert history and resource reports are stored only in the browser's local storage. No browser location permission and no health data are requested. Custom coordinates are rounded to about 1 km and sent only to Open-Meteo.

**How do you avoid false reassurance?**
- We never say "safe"; we say "comparatively lower-risk".
- Even the lowest band says heat illness is possible during hard work in sun.
- Forecast uncertainty and the shade assumption appear on every assessment.
- Emergency signs and numbers are always one click away.

**Why say the translations are drafts?**
Because they are. We wrote them ourselves. Safety-critical lines should be reviewed by native Urdu and Sindhi speakers, ideally with health workers, before any public use.

## Future improvements
1. WBGT estimate for outdoor workers, using solar radiation from the API, with a validated method.
2. Verified cooling-centre and water-point data via PDMA Sindh, KMC or NGOs, with a moderation workflow (for example Supabase plus review).
3. Local thresholds co-designed with PMD and public-health experts.
4. SMS or WhatsApp delivery through a real provider, with opt-in.
5. Multi-day heatwave detection and night-time minimum temperature (recovery) indicators.
6. Native-speaker review and audio guidance for people with low literacy.
