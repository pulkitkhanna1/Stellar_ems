# Deployment Quickstart

## Vercel (Recommended)

1. Open Vercel dashboard and create/import project from your repo.
2. Set project root to `ems-portal`.
3. Framework preset: `Other`.
4. Add env var in project settings:
   - `GOOGLE_DRIVE_API_KEY=<your_key>`
5. Deploy.
6. Open app and click `Sync From Drive`.

Notes:
- `vercel.json` is already configured.
- `data/day-plan.json` is served with `Cache-Control: no-store` for quick schedule updates.
- Secure proxy endpoint: `/api/drive-list`.

## GitHub Pages

1. Push `ems-portal` to repo root (or to `docs/`).
2. Enable Pages in repo settings for that branch/folder.
3. Keep `.nojekyll` present (already added).
4. Open your Pages URL.

Note: GitHub Pages cannot run the secure proxy endpoint, so live Drive sync will not work there unless you host the proxy elsewhere.

## Google API Key

- Enable `Google Drive API` in Google Cloud.
- Create API key.
- Store key only in Vercel env var `GOOGLE_DRIVE_API_KEY`.

## Regenerate Plan Data

If planner markdown changes:

```bash
cd ems-portal
python3 scripts/build_day_plan.py
```
