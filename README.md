# Stellar EMS Portal

A student-focused EMS-style study portal for your GMAT content.

## What It Does

- Renders your day-wise plan from `data/day-plan.json`.
- Tracks task completion in browser local storage.
- Indexes your Google Drive course folder recursively via secure server-side proxy.
- Auto-maps day-plan file references to real Drive links.
- Works best on Vercel (proxy-enabled).

## Files

- `index.html`: app shell
- `styles.css`: UI styling
- `app.js`: planner + Drive integration logic
- `config.js`: app config (folder ID)
- `api/drive-list.js`: secure Drive proxy endpoint (Vercel serverless)
- `data/day-plan.json`: day-wise schedule source
- `scripts/build_day_plan.py`: regenerate JSON from planner markdown

## Google Drive Setup (Secure)

1. Keep your Drive folder shared as `Anyone with link -> Viewer`.
2. Create a Google API key (Google Cloud Console):
   - Enable `Google Drive API`
   - Create API key
3. In Vercel Project Settings -> Environment Variables, add:
   - `GOOGLE_DRIVE_API_KEY=<your_key>`
4. Redeploy.

Configured folder ID:
- `11GTSMZQlZctn6XXfKf1J7mOicJQkN_bx`

## Run Locally

```bash
cd ems-portal
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

Note: local static server won't expose `/api/drive-list`. The planner still loads, but live Drive sync requires Vercel deployment.
For direct file-open mode, open:
- `/Users/pulkit/Downloads/Stellar/ems-portal/index.html`

## Deploy on Vercel

1. Import this `ems-portal` folder as a project.
2. Framework preset: `Other` (static).
3. Output directory: `.`
4. Add env var `GOOGLE_DRIVE_API_KEY`.
5. Deploy.

The repo already includes `vercel.json` tuned for this portal.

## Deploy on GitHub Pages

1. Push `ems-portal` contents to a GitHub repo root (or `docs/`).
2. Enable GitHub Pages from that branch/folder.
3. Open your Pages URL.

`ems-portal/.nojekyll` is already included.

Note: GitHub Pages alone cannot run the secure proxy endpoint.

## Regenerate Day Plan JSON

After planner edits:

```bash
python3 scripts/build_day_plan.py
```
