# Stellar EMS Portal

A student-focused EMS-style study portal for your GMAT content.

## What It Does

- Renders your day-wise plan from `data/day-plan.json`.
- Tracks task completion in browser local storage.
- Uses static public link map from `data/public-links.json`.
- Auto-maps day-plan file references to direct public Drive links.
- Works on any static host (GitHub Pages, Vercel, local server).

## Files

- `index.html`: app shell
- `styles.css`: UI styling
- `app.js`: planner + static link integration logic
- `config.js`: app config (folder ID)
- `data/day-plan.json`: day-wise schedule source
- `data/public-links.json`: direct public Drive link map
- `scripts/build_day_plan.py`: regenerate JSON from planner markdown
- `scripts/build_public_links.py`: regenerate public link map from Drive (optional)

Configured folder ID:
- `11GTSMZQlZctn6XXfKf1J7mOicJQkN_bx`

## Run Locally

```bash
cd ems-portal
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

Note: this app is static-only now, so local static serving works fully.
For direct file-open mode, open:
- `/Users/pulkit/Downloads/Stellar/ems-portal/index.html`

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

Note: GitHub Pages works directly because this is now static-only.

## Regenerate Day Plan JSON

After planner edits:

```bash
python3 scripts/build_day_plan.py
```

## Regenerate Direct Public Links

```bash
python3 scripts/build_public_links.py
```
