# Hackathon demo script (about 5 minutes)

**Before you present**
- Run `npm run dev` (or open your deployed URL) 10 minutes early and check that the status pill says **Live data**.
- Open a second tab at `http://localhost:5173/?demo=1` as a backup. If the venue Wi-Fi fails, switch to that tab and **say out loud** that you are now showing labelled demo data.
- Set the browser zoom to 110–125 % for the projector.
- On the Alerts page, click **Allow browser notifications** once, so the permission prompt doesn't appear mid-demo.

---

### 1. The problem (30 s)
> "Extreme heat hits outdoor workers, older people and families who often don't get timely, understandable information or know where to find water and cooling. CL-02 asks for a platform that turns weather data into a documented risk level and connects people to resources. That's ClimateTwin."

### 2. Current conditions and outlook (60 s), Overview page
- Point at the location and the **status pill**: "This is live Open-Meteo data, retrieved at [time]."
- The big number: "The heat index is how hot it feels in the shade once humidity is added. Today it's [value]. That puts us in [category]."
- The **24-hour ribbon**: "Each bar is one forecast hour. Height is the heat index, colour is the category. You can see the elevated period from [x] to [y]."
- Click a hot hour to jump to the **Hourly outlook**. Show the chart, the shaded elevated band, and the hour detail with "what drives this hour".

### 3. How the risk engine works (45 s)
- Click **Explain this hour**.
> "No black box. It's the U.S. National Weather Service heat-index formula. You can see the inputs, which formula branch was used, the result, and the band it falls in. When humidity is under 40 % we flag limited confidence. When an input is missing, we show 'not available' instead of guessing. The same function powers every screen."

### 4. Safe Window Finder (45 s)
- Set 2 h, Outdoors, 6 AM to 8 PM.
> "A labourer has two hours of outdoor work. The most favourable window is [x]. Every other window says why it ranked lower: 'reaches Danger, best window stays at Extreme caution'. The rules are listed, and there's no hidden score. We say 'lower-risk', never 'safe'."
- Optional: set a fixed start of 2 PM to show the comparison.

### 5. What-If Simulator (45 s)
- Pick the hottest hour, then click **Heatwave day**.
> "What if tomorrow is 4 degrees hotter? Heat index goes up by [Δ] and the category moves from [a] to [b]. It's clearly marked as simulated."
- Click **Calmer air**: "Wind isn't part of the heat index, so the app tells you a wind-only change can't change the category. It's honest about its own limits."
- Drag humidity to +40 on a humid night hour: "The scenario is rejected, not clamped. Bad inputs never reach the formula."

### 6. Resource map (30 s)
- Open the **Resource map** and click a marker.
> "Water points, cooling spaces and assistance desks. These are clearly labelled samples, because we didn't have a verified list and we won't invent one. Anyone can suggest a location or report an outdated one; it stays marked unverified."

### 7. Urdu and Sindhi (20 s)
- Click **اردو**: the whole layout mirrors right-to-left, while the timeline and chart stay in time order.
- Click **سنڌي**, then open **Alerts and guidance** to show the warning signs in Sindhi.
> "These are draft translations that we flag for native-speaker review."

### 8. Architecture, limitations, impact (45 s)
- Open **Data and methodology** and scroll to the **Evaluation panel**.
> "These checks run live in the browser. The engine matches eight NWS chart values within 1 °F, the category boundaries are exact, and the simulator properties hold. We have 79 automated tests."
> "Limitations: these are U.S. reference thresholds, not PMD criteria; the heat index assumes shade; the resources are samples. Next steps: partner with PDMA Sindh or KMC for verified cooling centres, and with PMD for local thresholds and SMS delivery."

---

### If something fails live
| Problem | What to do |
|---|---|
| Wi-Fi down / API error | The app shows an honest error. Say "this is the failure path working as designed", then click **Continue with labelled demo data**. |
| Map tiles don't load | The list and details panel still work. Use them. |
| Notification doesn't appear | Browser or OS notifications may be blocked. The in-app banner and history still show the alert. |
