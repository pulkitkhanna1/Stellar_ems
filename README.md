# Stellar EMS Portal

A student-focused EMS-style study portal for your GMAT content.

## What It Does

- Renders your day-wise plan from `data/day-plan.json`.
- Tracks task completion in browser local storage.
- Indexes your Google Drive course folder recursively.
- Auto-maps day-plan file references to real Drive links.
- Works on both Vercel and GitHub Pages.

## Files

- `index.html`: app shell
- `styles.css`: UI styling
- `app.js`: planner + Drive integration logic
- `config.js`: app config (folder ID + API key)
- `data/day-plan.json`: day-wise schedule source
- `scripts/build_day_plan.py`: regenerate JSON from planner markdown

## Google Drive Setup

1. Keep your Drive folder shared as `Anyone with link -> Viewer`.
2. Create a Google API key (Google Cloud Console):
   - Enable `Google Drive API`
   - Create API key
   - Add HTTP referrer restrictions for your domain(s) if desired
3. Paste the key in `config.js` or in-app API key field.

Configured folder ID:
- `11GTSMZQlZctn6XXfKf1J7mOicJQkN_bx`

## Run Locally

```bash
cd ems-portal
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

## Deploy on Vercel

1. Import this `ems-portal` folder as a project.
2. Framework preset: `Other` (static).
3. Output directory: `.`
4. Deploy.

The repo already includes `vercel.json` tuned for this portal.

## Deploy on GitHub Pages

1. Push `ems-portal` contents to a GitHub repo root (or `docs/`).
2. Enable GitHub Pages from that branch/folder.
3. Open your Pages URL.

`ems-portal/.nojekyll` is already included.

## Regenerate Day Plan JSON

After planner edits:

```bash
python3 scripts/build_day_plan.py
```
