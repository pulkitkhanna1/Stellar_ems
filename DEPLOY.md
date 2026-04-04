# Deployment Quickstart

## Vercel (Recommended)

1. Open Vercel dashboard and create/import project from your repo.
2. Set project root to `ems-portal`.
3. Framework preset: `Other`.
4. Deploy.
5. Open app and click `Reload Links` if needed.

Notes:
- `vercel.json` is already configured.
- `data/day-plan.json` is served with `Cache-Control: no-store` for quick schedule updates.
- Direct public hyperlinks are preloaded from `data/public-links.json`.

## GitHub Pages

1. Push `ems-portal` to repo root (or to `docs/`).
2. Enable Pages in repo settings for that branch/folder.
3. Keep `.nojekyll` present (already added).
4. Open your Pages URL.

Note: GitHub Pages works directly because the app now uses static public links only.

## Regenerate Plan Data

If planner markdown changes:

```bash
cd ems-portal
python3 scripts/build_day_plan.py
```

If Drive file inventory changes, refresh direct hyperlink map:

```bash
cd ems-portal
python3 scripts/build_public_links.py
```
