# Deployment Quickstart

## Vercel (Recommended)

1. Open Vercel dashboard and create/import project from your repo.
2. Set project root to `ems-portal`.
3. Framework preset: `Other`.
4. Deploy.
5. Open app and add Google API key in sidebar (or set in `config.js`).

Notes:
- `vercel.json` is already configured.
- `data/day-plan.json` is served with `Cache-Control: no-store` for quick schedule updates.

## GitHub Pages

1. Push `ems-portal` to repo root (or to `docs/`).
2. Enable Pages in repo settings for that branch/folder.
3. Keep `.nojekyll` present (already added).
4. Open your Pages URL.

## Google API Key

- Enable `Google Drive API` in Google Cloud.
- Create API key.
- Restrict by HTTP referrer to your Vercel and GitHub Pages domains.
- Add key in app sidebar or `config.js`.

## Regenerate Plan Data

If planner markdown changes:

```bash
cd ems-portal
python3 scripts/build_day_plan.py
```
