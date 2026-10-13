# CoolRoute demo script (about 5 minutes)

**Before you present**
- Start `npm run dev` (or open the deployed URL) 10 minutes early and check that the status pill says **Live data**.
- Keep a second tab on `http://localhost:5173/?demo=1` as a backup. If the Wi-Fi fails, switch to it and **say** you're showing labelled demo data.
- Pick light or dark mode to suit the projector. Light is usually clearer in bright rooms.
- Zoom the browser to 110–125 %.

### 1. The problem (30 s)
> "Extreme heat hits outdoor workers, older people and families who often don't get timely, understandable information or know where to find water and cooling. CL-02 asks for a platform that turns weather data into a documented risk level and connects people to resources. That's CoolRoute."

### 2. The Dashboard (60 s)
- "Everything for one city on one screen. This is live Open-Meteo data."
- The **heat index** card: "This is how hot it feels in the shade. Right now that's [value], which is [category]."
- **Heat risk now**, *Why this level*: read the plain-language reasons aloud (temperature, humidity effect, sun, band).
- Click **Learn how this is calculated**: "No black box. It's the U.S. National Weather Service formula, with the band it falls in."
- The **24-hour ribbon**: "Each bar is one hour. Height is heat index, colour is risk. You can see the danger period from [x] to [y]."

### 3. Any city (30 s)
- Type `Hyder` in the search. "Two Hyderabads, one in India and one in Pakistan. Region and country make it clear which is which."
- Choose Hyderabad, Sindh. "The weather, risk, map and alerts all switched together. We never show one city's numbers under another city's name."
- Optional: search `Jacobabad`, one of the hottest cities on Earth.

### 4. Resource map (30 s)
- On the Dashboard map, filter by water and cooling, then click a nearby entry.
> "These are clearly labelled samples. We didn't have a verified list, and we won't invent one. Residents can suggest places; they stay 'unverified' until someone accountable checks them."

### 5. Safe Window Finder (45 s)
- 2 h, Outdoors, 6 AM–8 PM. "The most favourable time is [x]. Every other window says why it ranked lower. The rules are listed; there's no hidden score. We say 'lower-risk', never 'safe'."

### 6. What-If Simulator (30 s)
- Choose **Heatwave day**. "What if it's 4 degrees hotter? The category moves from [a] to [b]. It's clearly marked as simulated."

### 7. Accessibility and languages (30 s)
- Switch to **dark mode**: "It's a full dark design, and the choice is remembered."
- Choose **اردو**: "The layout mirrors right-to-left while numbers and the timeline stay readable. These translations are drafts we flag for native-speaker review."

### 8. Trust and next steps (45 s)
- Open **Data and methodology**, then the evaluation panel. "These checks run live: the formula matches the NWS chart, the category boundaries are exact, and we have [N] automated tests."
- "Limits: U.S. reference thresholds, not PMD; the heat index assumes shade; resources are samples. Next steps: verified cooling centres with PDMA Sindh and local NGOs, local thresholds with PMD, and SMS alerts."

### If something fails live
| Problem | What to do |
|---|---|
| Weather API error | Say "this is the honest failure path", then click **Continue with labelled demo data**. |
| City search unavailable | Pick a recent or suggested city from the search list; they're stored in the browser. |
| Map tiles don't load | The list and details below the map still work. |
